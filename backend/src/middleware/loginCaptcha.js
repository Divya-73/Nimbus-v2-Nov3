import { error, success } from '../utils/response.js';
import {
  checkMathCaptcha,
  consumeCaptchaPassToken,
  consumeMathCaptcha,
  createMathCaptcha,
  issueCaptchaPassToken,
  resolveCaptchaProvider,
  verifyTurnstileToken,
} from '../utils/captchaService.js';
import { isCaptchaRequired, clearLoginFailures } from './loginThrottle.js';

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || '';
}

function captchaRequiredPayload(req, provider) {
  return {
    captchaRequired: true,
    captchaProvider: provider,
    captchaStep: 'verify',
  };
}

/** Step 1 — verify CAPTCHA and issue a pass token before password entry. */
export async function verifyLoginCaptcha(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error(res, 'Valid email is required for verification', 400);
  }

  let provider;
  try {
    provider = resolveCaptchaProvider();
  } catch (err) {
    return error(res, err.message || 'CAPTCHA is not configured', 503);
  }

  if (provider === 'turnstile') {
    const token = String(req.body?.turnstileToken || req.body?.captchaToken || '').trim();
    if (!token) {
      return error(res, 'Complete the CAPTCHA verification.', 400, captchaRequiredPayload(req, provider));
    }

    try {
      const valid = await verifyTurnstileToken(token, clientIp(req));
      if (!valid) {
        return error(res, 'CAPTCHA verification failed. Try again.', 400, captchaRequiredPayload(req, provider));
      }
    } catch {
      return error(res, 'CAPTCHA verification service unavailable.', 503, captchaRequiredPayload(req, provider));
    }
  } else {
    const captchaId = String(req.body?.captchaId || '').trim();
    const captchaAnswer = req.body?.captchaAnswer;
    if (!captchaId || captchaAnswer == null || String(captchaAnswer).trim() === '') {
      return error(res, 'Complete the CAPTCHA verification.', 400, captchaRequiredPayload(req, 'math'));
    }

    if (!checkMathCaptcha(captchaId, captchaAnswer, clientIp(req))) {
      return error(res, 'Incorrect CAPTCHA answer. Try again.', 400, captchaRequiredPayload(req, 'math'));
    }
    consumeMathCaptcha(captchaId);
  }

  const pass = issueCaptchaPassToken(email, clientIp(req));
  clearLoginFailures(req);
  return success(
    res,
    {
      ...pass,
      captchaStep: 'password',
      message: 'Verification passed. Enter your password to sign in.',
    },
    'CAPTCHA verified'
  );
}

/** Step 2 — require a valid pass token when CAPTCHA is required for this account/IP. */
export async function requireLoginCaptcha(req, res, next) {
  if (!isCaptchaRequired(req)) return next();

  const email = String(req.body?.email || '').trim().toLowerCase();
  const passToken = String(req.body?.captchaPassToken || '').trim();

  if (passToken && consumeCaptchaPassToken(passToken, email, clientIp(req))) {
    req.captchaVerified = true;
    return next();
  }

  let provider;
  try {
    provider = resolveCaptchaProvider();
  } catch (err) {
    return error(res, err.message || 'CAPTCHA is not configured', 503);
  }

  return error(
    res,
    'Complete security verification before signing in.',
    400,
    captchaRequiredPayload(req, provider)
  );
}

/** Issue a fresh math CAPTCHA challenge (Turnstile uses widget on the client). */
export function issueLoginCaptcha(req, res) {
  try {
    const provider = resolveCaptchaProvider();
    if (provider === 'turnstile') {
      return error(res, 'Use the Turnstile widget for verification.', 400, {
        captchaProvider: 'turnstile',
        captchaStep: 'verify',
      });
    }

    const challenge = createMathCaptcha(clientIp(req));
    return res.status(200).json({
      success: true,
      message: 'CAPTCHA issued',
      data: { ...challenge, captchaStep: 'verify' },
      requestId: req.id,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to issue CAPTCHA', 500);
  }
}
