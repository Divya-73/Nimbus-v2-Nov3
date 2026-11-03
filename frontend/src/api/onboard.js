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
    if (!str || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

/**
 * GET /onboard — reported devices not assigned to org/branch.
 */
export async function fetchOnboardDevices({ page = 1, pageSize = 10, search, model } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ page, pageSize, search, model });
    const { data } = await api.get('/onboard', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch onboard devices');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch onboard devices');
  }
}

/** GET /onboard/:id — unassigned CPE plus SLA defaults and iface slots. */
export async function fetchOnboardDevice(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/onboard/${encodeURIComponent(String(deviceId).trim())}`
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch onboard device');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch onboard device');
  }
}

/** POST /onboard/assign */
export async function assignOnboardDevice(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/onboard/assign', payload);
    if (!data.success) throw new Error(data.message || 'Failed to assign device');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to assign device');
  }
}

/** DELETE /onboard/:id */
export async function deleteOnboardDevice(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.delete(
      `/onboard/${encodeURIComponent(String(deviceId).trim())}`
    );
    if (!data.success) throw new Error(data.message || 'Failed to delete onboard device');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete onboard device');
  }
}
