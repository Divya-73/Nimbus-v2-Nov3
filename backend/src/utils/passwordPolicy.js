/** Password policy aligned with VAPT account-management requirements. */

export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
});

const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /[0-9]/;
const SPECIAL_RE = /[^A-Za-z0-9]/;

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'admin',
  'administrator',
  'admin123',
  'letmein',
  'welcome',
  'welcome1',
  'changeme',
  'passw0rd',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'login',
  'guest',
  'nimbus',
  'nimbus123',
  'default',
  'test',
  'test123',
  'abc123',
  'football',
  'shadow',
  'sunshine',
  'princess',
  'trustno1',
]);

const POLICY_SUMMARY =
  'Password must be at least 12 characters and include uppercase, lowercase, number, and special character.';

function hasSequentialRun(value, minRun = 4) {
  const lower = String(value || '').toLowerCase();
  if (lower.length < minRun) return false;

  for (let i = 0; i <= lower.length - minRun; i += 1) {
    let ascending = true;
    let descending = true;
    for (let j = 0; j < minRun - 1; j += 1) {
      const cur = lower.charCodeAt(i + j);
      const next = lower.charCodeAt(i + j + 1);
      if (next !== cur + 1) ascending = false;
      if (next !== cur - 1) descending = false;
    }
    if (ascending || descending) return true;
  }
  return false;
}

function hasRepeatedChars(value, minRepeat = 4) {
  const s = String(value || '');
  return new RegExp(`(.)\\1{${minRepeat - 1},}`).test(s);
}

function emailLocalPart(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0) return normalized;
  return normalized.slice(0, at);
}

/**
 * Validate password strength.
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validatePassword(password, { email } = {}) {
  const errors = [];
  const value = typeof password === 'string' ? password : '';

  if (!value) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (value.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (value.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must be at most ${PASSWORD_POLICY.maxLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !UPPERCASE_RE.test(value)) {
    errors.push('Password must include at least one uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !LOWERCASE_RE.test(value)) {
    errors.push('Password must include at least one lowercase letter');
  }
  if (PASSWORD_POLICY.requireDigit && !DIGIT_RE.test(value)) {
    errors.push('Password must include at least one number');
  }
  if (PASSWORD_POLICY.requireSpecial && !SPECIAL_RE.test(value)) {
    errors.push('Password must include at least one special character');
  }

  const lowered = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    errors.push('Password is too common or easily guessable');
  }
  if (hasSequentialRun(value) || hasRepeatedChars(value)) {
    errors.push('Password must not contain predictable or repeated character sequences');
  }

  const local = emailLocalPart(email);
  if (local && local.length >= 3) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (lowered === normalizedEmail || lowered === local || lowered.includes(local)) {
      errors.push('Password must not match or contain the account email');
    }
  }

  return { isValid: errors.length === 0, errors };
}

/** Throw a 400 error when password policy is not met. */
export function assertPasswordPolicy(password, options = {}) {
  const { isValid, errors } = validatePassword(password, options);
  if (isValid) return;

  const err = new Error(errors[0] || POLICY_SUMMARY);
  err.status = 400;
  err.errors = errors;
  throw err;
}

export { POLICY_SUMMARY };
