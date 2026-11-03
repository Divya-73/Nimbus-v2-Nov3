import jwt from 'jsonwebtoken';

function secret() {
  const v = process.env.JWT_SECRET?.trim();
  if (!v) throw new Error('Missing required environment variable: JWT_SECRET');
  return v;
}

const GUI_TYP = 'device-gui';

/**
 * Short-lived token so the browser can load GUI assets without Bearer header.
 * @param {{ deviceId: string, guiIp: string, userId: string, protocol?: string, port?: number }} payload
 */
export function createGuiAccessToken({ deviceId, guiIp, userId, protocol = 'https', port = 443 }) {
  const expiresIn = process.env.DEVICE_GUI_SESSION_TTL || '30m';
  return jwt.sign(
    {
      typ: GUI_TYP,
      deviceId: String(deviceId),
      guiIp: String(guiIp),
      protocol: protocol === 'http' ? 'http' : 'https',
      port: Number(port) || (protocol === 'http' ? 80 : 443),
      userId: String(userId || ''),
    },
    secret(),
    { expiresIn }
  );
}

export function verifyGuiAccessToken(token) {
  const decoded = jwt.verify(String(token || ''), secret());
  if (decoded?.typ !== GUI_TYP || !decoded.deviceId || !decoded.guiIp) {
    throw new Error('Invalid GUI session token');
  }
  const protocol = decoded.protocol === 'http' ? 'http' : 'https';
  const port = Number(decoded.port) || (protocol === 'http' ? 80 : 443);
  return {
    deviceId: String(decoded.deviceId),
    guiIp: String(decoded.guiIp),
    protocol,
    port,
    userId: String(decoded.userId || ''),
  };
}

export function guiSessionTtlSeconds() {
  const raw = process.env.DEVICE_GUI_SESSION_TTL || '30m';
  const m = String(raw).match(/^(\d+)([smhd])$/i);
  if (!m) return 1800;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 1800;
}
