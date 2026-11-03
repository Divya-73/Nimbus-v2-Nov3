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
 * GET /login-logs
 * @returns {{ logs, total, page, pageSize }}
 */
export async function fetchLoginLogs({
  page = 1,
  pageSize = 50,
  search,
  username,
  ip,
  status,
  orgId,
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
      ip,
      status,
      orgId,
      fromTime,
      toTime,
    });
    const { data } = await api.get('/login-logs', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch login logs');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch login logs');
  }
}
