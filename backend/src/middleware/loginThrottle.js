/** Progressive delay after repeated failed login attempts (in-memory, per IP + email). */

import {
  captchaThreshold,
  getTurnstileSiteKey,
  resolveCaptchaProvider,
} from '../utils/captchaService.js';

const failures = new Map();

function windowMs() {
  return Math.max(60, Number(process.env.LOGIN_ACCOUNT_RATE_LIMIT_WINDOW || 900)) * 1000;
}

function throttleKey(req) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}|${email || 'unknown'}`;
}

function getEntry(key) {
  const entry = failures.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    failures.delete(key);
    return null;
  }
  return entry;
}

/** Slow down repeat offenders before password verification runs. */
export function applyLoginProgressiveDelay(req, res, next) {
  // CAPTCHA already verified — no artificial wait on sign-in.
  if (String(req.body?.captchaPassToken || '').trim()) {
    return next();
  }

  const entry = getEntry(throttleKey(req));
  const count = entry?.count || 0;
  // Only delay after 2+ failures; first retry stays responsive.
  if (count < 2) return next();

  const base = Math.max(100, Number(process.env.LOGIN_PROGRESSIVE_DELAY_MS || 500));
  const max = Math.max(base, Number(process.env.LOGIN_PROGRESSIVE_DELAY_MAX_MS || 5000));
  const delayMs = Math.min((count - 1) * base, max);

  setTimeout(next, delayMs);
}

export function recordLoginFailure(req) {
  const key = throttleKey(req);
  const now = Date.now();
  const entry = getEntry(key);
  const count = (entry?.count || 0) + 1;
  failures.set(key, { count, expiresAt: now + windowMs() });
}

export function clearLoginFailures(req) {
  failures.delete(throttleKey(req));
}

export function getFailureCount(req) {
  const entry = getEntry(throttleKey(req));
  return entry?.count || 0;
}

export function isCaptchaRequired(req) {
  return getFailureCount(req) >= captchaThreshold();
}

/** Attach CAPTCHA hint for clients after repeated failures. */
export function loginCaptchaExtras(req) {
  if (!isCaptchaRequired(req)) return {};
  try {
    const provider = resolveCaptchaProvider();
    return {
      captchaRequired: true,
      captchaProvider: provider,
      captchaStep: 'verify',
      ...(provider === 'turnstile' ? { turnstileSiteKey: getTurnstileSiteKey() } : {}),
    };
  } catch {
    return { captchaRequired: true, captchaProvider: 'math' };
  }
}
