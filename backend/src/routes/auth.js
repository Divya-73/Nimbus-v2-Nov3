import express from 'express';
import { login, refresh, profile, logout } from '../controllers/authControllers.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateLogin, validateRefresh } from '../middleware/validation.js';
import {
  loginIpRateLimiter,
  loginAccountRateLimiter,
  refreshRateLimiter,
  captchaIssueRateLimiter,
} from '../middleware/rateLimit.js';
import { applyLoginProgressiveDelay } from '../middleware/loginThrottle.js';
import { issueLoginCaptcha, requireLoginCaptcha, verifyLoginCaptcha } from '../middleware/loginCaptcha.js';
import { captchaPublicConfig } from '../utils/captchaService.js';
import { success } from '../utils/response.js';

const router = express.Router();

router.get('/captcha/config', (_req, res) => {
  return success(res, captchaPublicConfig(), 'CAPTCHA configuration');
});

router.get('/captcha', captchaIssueRateLimiter, issueLoginCaptcha);

router.post('/captcha/verify', captchaIssueRateLimiter, verifyLoginCaptcha);

router.post(
  '/login',
  loginIpRateLimiter,
  applyLoginProgressiveDelay,
  requireLoginCaptcha,
  loginAccountRateLimiter,
  validateLogin,
  login
);
router.post('/refresh', refreshRateLimiter, validateRefresh, refresh);
router.get('/profile', authenticate, profile);
router.post('/logout', authenticate, logout);

export default router;
