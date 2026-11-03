const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginInput(email, password) {
  const errors = [];
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.push('Valid email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 1) {
    errors.push('Password is required');
  }
  return { isValid: errors.length === 0, errors };
}

export function validateRefreshInput(refreshToken) {
  const errors = [];
  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
    errors.push('Refresh token is required');
  }
  return { isValid: errors.length === 0, errors };
}
