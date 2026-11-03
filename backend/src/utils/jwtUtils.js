import jwt from 'jsonwebtoken';

function secret(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function userPayload(user) {
  return {
    userId: user._id || user.id,
    email: user.email,
    role: user.role != null ? String(user.role) : '',
    orgId: user.orgId || '',
    branchId: user.branchId || '',
    tokenVersion: user.tokenVersion || 0,
  };
}

export function generateAccessToken(user) {
  return jwt.sign(userPayload(user), secret('JWT_SECRET'), {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, tokenVersion: user.tokenVersion || 0 },
    secret('JWT_REFRESH_SECRET'),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, secret('JWT_SECRET'));
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, secret('JWT_REFRESH_SECRET'));
}
