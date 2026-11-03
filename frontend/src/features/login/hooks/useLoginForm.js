import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchLoginCaptcha,
  getCaptchaConfig,
  login,
  verifyLoginCaptcha,
} from '../../../api/auth';
import { canAccessConsole } from '../../../utils/roleManagement';

export function useLoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaStep, setCaptchaStep] = useState(null);
  const [captchaProvider, setCaptchaProvider] = useState('math');
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaPassToken, setCaptchaPassToken] = useState('');

  const loadMathCaptcha = useCallback(async () => {
    const challenge = await fetchLoginCaptcha();
    setCaptchaId(challenge.captchaId || '');
    setCaptchaQuestion(challenge.question || '');
    setCaptchaAnswer('');
    setTurnstileToken('');
  }, []);

  const activateCaptcha = useCallback(
    async (provider, siteKey = '') => {
      setCaptchaRequired(true);
      setCaptchaStep('verify');
      setCaptchaProvider(provider || 'math');
      setCaptchaPassToken('');
      setPassword('');
      setInfo('');
      if (provider === 'turnstile') {
        setTurnstileSiteKey(siteKey);
        setCaptchaId('');
        setCaptchaQuestion('');
        setCaptchaAnswer('');
        setTurnstileToken('');
        return;
      }
      await loadMathCaptcha();
    },
    [loadMathCaptcha]
  );

  async function handleVerifyCaptcha(event) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    const captchaPayload =
      captchaProvider === 'turnstile'
        ? { turnstileToken }
        : { captchaId, captchaAnswer: String(captchaAnswer).trim() };

    if (captchaProvider === 'turnstile') {
      if (!turnstileToken) {
        setError('Please complete the security verification');
        return;
      }
    } else if (!captchaId || !String(captchaAnswer).trim()) {
      setError('Please complete the security verification');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setInfo('');
      const result = await verifyLoginCaptcha(trimmedEmail, captchaPayload);
      setCaptchaPassToken(result.captchaPassToken || '');
      setCaptchaStep('password');
      setPassword('');
      setCaptchaAnswer('');
      setTurnstileToken('');
      setInfo(result.message || 'Verification passed. Enter your password to sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CAPTCHA verification failed');
      if (err.captchaRequired && captchaProvider !== 'turnstile') {
        await loadMathCaptcha();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (captchaRequired && captchaStep === 'verify') {
      return handleVerifyCaptcha(event);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (captchaRequired && captchaStep === 'password' && !captchaPassToken) {
      setError('Complete security verification before signing in.');
      setCaptchaStep('verify');
      await activateCaptcha(captchaProvider, turnstileSiteKey);
      return;
    }

    const captchaPayload =
      captchaRequired && captchaPassToken ? { captchaPassToken } : {};

    try {
      setLoading(true);
      setError('');
      setInfo('');
      const { user } = await login(trimmedEmail, password, captchaPayload);

      if (!canAccessConsole(user)) {
        setError('Your account does not have console access. Contact your administrator.');
        setLoading(false);
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setLoading(false);
      setCaptchaPassToken('');

      if (err.captchaRequired || err.captchaStep === 'verify') {
        await activateCaptcha(err.captchaProvider || captchaProvider || 'math', err.turnstileSiteKey || turnstileSiteKey);
      }
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    info,
    handleSubmit,
    captchaRequired,
    captchaStep,
    captchaProvider,
    turnstileSiteKey,
    captchaQuestion,
    captchaAnswer,
    setCaptchaAnswer,
    setTurnstileToken,
    refreshCaptcha: loadMathCaptcha,
  };
}
