import { randomUUID, createHmac, timingSafeEqual } from 'crypto';

const challenges = new Map();
const passTokens = new Map();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PASS_TOKEN_TTL_MS = 5 * 60 * 1000;

function passSecret() {
  return String(process.env.JWT_SECRET || process.env.CAPTCHA_PASS_SECRET || 'captcha-pass-dev-secret');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeIp(ip) {
  return String(ip || 'unknown');
}

function pruneChallenge(id) {
  const entry = challenges.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    challenges.delete(id);
    return null;
  }
  return entry;
}

function prunePassToken(token) {
  const entry = passTokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    passTokens.delete(token);
    return null;
  }
  return entry;
}

export function captchaThreshold() {
  return Math.max(1, Number(process.env.LOGIN_CAPTCHA_AFTER_FAILURES || 3));
}

export function resolveCaptchaProvider() {
  const configured = String(process.env.CAPTCHA_PROVIDER || 'auto').trim().toLowerCase();
  const siteKey = String(process.env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = String(process.env.TURNSTILE_SECRET_KEY || '').trim();

  if (configured === 'turnstile') {
    if (!siteKey || !secretKey) {
      throw new Error('Turnstile CAPTCHA is enabled but TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are missing');
    }
    return 'turnstile';
  }
  if (configured === 'math') return 'math';
  if (siteKey && secretKey) return 'turnstile';
  return 'math';
}

export function getTurnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Issue a one-time math CAPTCHA challenge bound to client IP. */
export function createMathCaptcha(clientIp = '') {
  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const id = randomUUID();
  const answer = String(a + b);

  challenges.set(id, {
    answer,
    ip: String(clientIp || 'unknown'),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });

  return {
    provider: 'math',
    captchaId: id,
    question: `What is ${a} + ${b}?`,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

export function verifyMathCaptcha(captchaId, captchaAnswer, clientIp = '') {
  const id = String(captchaId || '').trim();
  if (!id) return false;

  const entry = pruneChallenge(id);
  if (!entry) return false;

  challenges.delete(id);

  const ip = String(clientIp || 'unknown');
  if (entry.ip !== ip) return false;

  const given = String(captchaAnswer ?? '').trim();
  if (!given) return false;

  return given === entry.answer;
}

/** Verify math answer without consuming the challenge (used by /captcha/verify). */
export function checkMathCaptcha(captchaId, captchaAnswer, clientIp = '') {
  const id = String(captchaId || '').trim();
  if (!id) return false;

  const entry = pruneChallenge(id);
  if (!entry) return false;

  const ip = normalizeIp(clientIp);
  if (entry.ip !== ip) return false;

  const given = String(captchaAnswer ?? '').trim();
  if (!given) return false;

  return given === entry.answer;
}

/** Consume math challenge after successful standalone verification. */
export function consumeMathCaptcha(captchaId) {
  const id = String(captchaId || '').trim();
  if (!id) return;
  challenges.delete(id);
}

/** Issue a short-lived pass token after CAPTCHA is verified (step 1). */
export function issueCaptchaPassToken(email, clientIp = '') {
  const normalizedEmail = normalizeEmail(email);
  const ip = normalizeIp(clientIp);
  const token = randomUUID();
  const sig = createHmac('sha256', passSecret())
    .update(`${token}|${normalizedEmail}|${ip}`)
    .digest('hex');

  passTokens.set(token, {
    email: normalizedEmail,
    ip,
    sig,
    expiresAt: Date.now() + PASS_TOKEN_TTL_MS,
  });

  return {
    captchaPassToken: token,
    expiresInSeconds: Math.floor(PASS_TOKEN_TTL_MS / 1000),
  };
}

/** Validate and consume a CAPTCHA pass token for login (step 2). */
export function consumeCaptchaPassToken(token, email, clientIp = '') {
  const id = String(token || '').trim();
  if (!id) return false;

  const entry = prunePassToken(id);
  if (!entry) return false;

  const normalizedEmail = normalizeEmail(email);
  const ip = normalizeIp(clientIp);
  if (entry.email !== normalizedEmail || entry.ip !== ip) return false;

  const expected = createHmac('sha256', passSecret())
    .update(`${id}|${normalizedEmail}|${ip}`)
    .digest('hex');

  try {
    if (!timingSafeEqual(Buffer.from(entry.sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }

  passTokens.delete(id);
  return true;
}

export async function verifyTurnstileToken(token, clientIp = '') {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return false;

  const body = new URLSearchParams({
    secret,
    response: String(token || ''),
    remoteip: String(clientIp || ''),
  });

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return false;

  const payload = await response.json();
  return payload?.success === true;
}

export function captchaPublicConfig() {
  const provider = resolveCaptchaProvider();
  if (provider === 'turnstile') {
    return {
      provider,
      siteKey: getTurnstileSiteKey(),
      threshold: captchaThreshold(),
    };
  }
  return {
    provider: 'math',
    siteKey: '',
    threshold: captchaThreshold(),
  };
}
