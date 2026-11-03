import { api } from './auth';
import { getAccessToken } from '../utils/roleManagement';

function toError(error, fallback) {
  return new Error(error.response?.data?.message || error.message || fallback);
}

function requireAuth() {
  if (!getAccessToken()) {
    window.location.href = '/login';
    throw new Error('No access token found');
  }
}

function cleanParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str === '' || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

/**
 * GET /device-deletion-logs
 * @returns {{ logs, total, page, pageSize }}
 */
export async function fetchDeviceDeletionLogs({
  page = 1,
  pageSize = 50,
  search,
  username,
  sysname,
  sessionId,
  userId,
  fromTime,
  toTime,
} = {}) {
  requireAuth();
  try {
    const params = cleanParams({
      page,
      pageSize,
      search,
      username,
      sysname,
      sessionId,
      userId,
      fromTime,
      toTime,
    });
    const { data } = await api.get('/device-deletion-logs', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch device deletion logs');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device deletion logs');
  }
}
