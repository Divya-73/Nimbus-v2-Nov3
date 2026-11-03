import rateLimit from 'express-rate-limit';

function windowMs(envName, fallbackSeconds) {
  return Math.max(60, Number(process.env[envName] || fallbackSeconds)) * 1000;
}

function maxAttempts(envName, fallback) {
  return Math.max(1, Number(process.env[envName] || fallback));
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function accountKey(req) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (email) return `acct:${email}`;
  return `ip:${clientIp(req)}`;
}

function accountLockHandler(req, res) {
  res.status(429).json({
    success: false,
    message:
      'Too many failed login attempts for this account. Complete verification, then enter your password again.',
    captchaRequired: true,
    captchaStep: 'verify',
    captchaProvider: 'math',
    requestId: req.id,
  });
}

function rateLimitHandler(defaultMessage) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      message: defaultMessage,
      requestId: req.id,
    });
  };
}

/** Broad IP throttle — limits total login POST volume from one address. */
export const loginIpRateLimiter = rateLimit({
  windowMs: windowMs('LOGIN_RATE_LIMIT_WINDOW', 900),
  max: maxAttempts('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many login attempts from this IP. Try again later.'),
  keyGenerator: (req) => `login-ip:${clientIp(req)}`,
});

/**
 * Account throttle — only failed logins count (401/403).
 * Temporarily locks out targeted accounts after repeated bad passwords.
 */
export const loginAccountRateLimiter = rateLimit({
  windowMs: windowMs('LOGIN_ACCOUNT_RATE_LIMIT_WINDOW', 900),
  max: maxAttempts('LOGIN_ACCOUNT_RATE_LIMIT_MAX_ATTEMPTS', 5),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => req.captchaVerified === true,
  handler: accountLockHandler,
  keyGenerator: accountKey,
});

export const refreshRateLimiter = rateLimit({
  windowMs: windowMs('REFRESH_RATE_LIMIT_WINDOW', 900),
  max: maxAttempts('REFRESH_RATE_LIMIT_MAX_ATTEMPTS', 60),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many refresh attempts. Try again later.'),
  keyGenerator: (req) => `refresh:${clientIp(req)}`,
});

/** Limit CAPTCHA challenge issuance to prevent abuse. */
export const captchaIssueRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many CAPTCHA requests. Try again later.'),
  keyGenerator: (req) => `captcha:${clientIp(req)}`,
});

/** @deprecated Use loginIpRateLimiter — kept for compatibility */
export const loginRateLimiter = loginIpRateLimiter;
