import { api } from './auth';
import { getAccessToken } from '../utils/roleManagement';
import { resolveApiOrigin } from './config';

function toError(error, fallback) {
  return new Error(error.response?.data?.message || error.message || fallback);
}

function requireAuth() {
  if (!getAccessToken()) {
    window.location.href = '/login';
    throw new Error('No access token found');
  }
}

/**
 * GET /devices/:id
 * @returns {object} full device detail
 */
export async function fetchDeviceById(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(`/devices/${encodeURIComponent(String(deviceId).trim())}`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch device details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device details');
  }
}

/**
 * POST /devices/:id/gui-session
 * @param {string} deviceId
 * @param {{ ip?: string }} [opts] — selected IPv4 when device has multiple
 * @returns {{ token, proxyPath, guiIp, deviceId, hostname, expiresIn }}
 */
export async function createDeviceGuiSession(deviceId, { ip } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const body = ip ? { ip: String(ip).trim() } : {};
    const { data } = await api.post(
      `/devices/${encodeURIComponent(String(deviceId).trim())}/gui-session`,
      body
    );
    if (!data.success) throw new Error(data.message || 'Failed to create GUI session');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create GUI session');
  }
}

function apiOrigin() {
  return resolveApiOrigin();
}

/** Create GUI session and open proxied device UI in a new tab. */
export async function openDeviceGui(deviceId, { ip } = {}) {
  const session = await createDeviceGuiSession(deviceId, { ip });
  const path = session?.proxyPath || `/api/v1/devices/gui-proxy/${encodeURIComponent(session.token)}/`;
  const url = `${apiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return session;
}

/**
 * POST /devices/:id/ssh-session
 * @returns {{ token, wsPath, host, port, username, deviceId, hostname, expiresIn }}
 */
export async function createDeviceSshSession(deviceId, { ip, username, password, port } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const body = {
      ip: ip ? String(ip).trim() : undefined,
      username: username ? String(username).trim() : undefined,
      password: password == null ? '' : String(password),
      port: port == null || port === '' ? undefined : Number(port),
    };
    const { data } = await api.post(
      `/devices/${encodeURIComponent(String(deviceId).trim())}/ssh-session`,
      body
    );
    if (!data.success) throw new Error(data.message || 'Failed to create SSH session');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create SSH session');
  }
}

export function deviceSshWebSocketUrl(session) {
  const token = String(session?.token || '').trim();
  const path = session?.wsPath
    || (token ? `/api/v1/devices/ssh-proxy/${encodeURIComponent(token)}` : '');
  if (!path) throw new Error('SSH session token missing');
  const httpOrigin = apiOrigin();
  const wsOrigin = httpOrigin.startsWith('https://')
    ? `wss://${httpOrigin.slice('https://'.length)}`
    : httpOrigin.startsWith('http://')
      ? `ws://${httpOrigin.slice('http://'.length)}`
      : httpOrigin.replace(/^http/i, 'ws');
  return `${wsOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}
