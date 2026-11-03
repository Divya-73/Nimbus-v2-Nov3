import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const SSH_TYP = 'device-ssh';
const secrets = new Map();

function jwtSecret() {
  const v = process.env.JWT_SECRET?.trim();
  if (!v) throw new Error('Missing required environment variable: JWT_SECRET');
  return v;
}

export function sshSessionTtlSeconds() {
  const raw = process.env.DEVICE_SSH_SESSION_TTL || '15m';
  const m = String(raw).match(/^(\d+)([smhd])$/i);
  if (!m) return 900;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 900;
}

function pruneSecrets() {
  const now = Date.now();
  for (const [id, row] of secrets) {
    if (!row || row.expiresAt <= now) secrets.delete(id);
  }
}

/** Password stays in memory only — never in the JWT or client payload. */
export function stashSshPassword(jti, password, ttlSeconds) {
  pruneSecrets();
  secrets.set(String(jti), {
    password: String(password),
    expiresAt: Date.now() + Math.max(30, Number(ttlSeconds) || 900) * 1000,
  });
}

export function readSshPassword(jti) {
  pruneSecrets();
  const row = secrets.get(String(jti));
  if (!row) return null;
  return row.password;
}

export function clearSshPassword(jti) {
  secrets.delete(String(jti));
}

export function createSshAccessToken({ deviceId, host, port, username, userId }) {
  const ttl = sshSessionTtlSeconds();
  const jti = randomUUID();
  const token = jwt.sign(
    {
      typ: SSH_TYP,
      jti,
      deviceId: String(deviceId),
      host: String(host),
      port: Number(port) || 22,
      username: String(username),
      userId: String(userId || ''),
    },
    jwtSecret(),
    { expiresIn: ttl }
  );
  return { token, jti, ttl };
}

export function verifySshAccessToken(token) {
  const decoded = jwt.verify(String(token || ''), jwtSecret());
  if (decoded?.typ !== SSH_TYP || !decoded.jti || !decoded.deviceId || !decoded.host) {
    throw new Error('Invalid SSH session token');
  }
  return {
    jti: String(decoded.jti),
    deviceId: String(decoded.deviceId),
    host: String(decoded.host),
    port: Number(decoded.port) || 22,
    username: String(decoded.username || ''),
    userId: String(decoded.userId || ''),
  };
}
