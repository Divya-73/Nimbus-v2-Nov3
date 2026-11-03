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

function unwrap(data, fallbackMessage) {
  if (!data?.success) throw new Error(data?.message || fallbackMessage);
  return data.data;
}

/** GET /alarm-configuration */
export async function fetchAlarmPolicies({ page = 1, pageSize = 50, search, orgId, deviceId } = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/alarm-configuration', {
      params: cleanParams({ page, pageSize, search, orgId, deviceId }),
    });
    const payload = unwrap(data, 'Failed to fetch alarm policies');
    return {
      policies: Array.isArray(payload?.policies) ? payload.policies : [],
      total: Number(payload?.total) || 0,
      page: Number(payload?.page) || page,
      pageSize: Number(payload?.pageSize) || pageSize,
    };
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm policies');
  }
}

/** GET /alarm-configuration/devices */
export async function fetchPolicyDevices({
  page = 1,
  pageSize = 25,
  search,
  tags,
  orgId,
  branchId,
  model,
  ids,
} = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/alarm-configuration/devices', {
      params: cleanParams({
        page,
        pageSize,
        search,
        tags,
        orgId,
        branchId,
        model,
        ids: Array.isArray(ids) ? ids.filter(Boolean).join(',') : ids,
      }),
    });
    const payload = unwrap(data, 'Failed to fetch devices');
    return {
      devices: Array.isArray(payload?.devices) ? payload.devices : [],
      selected: Array.isArray(payload?.selected) ? payload.selected : [],
      models: Array.isArray(payload?.models) ? payload.models : [],
      total: Number(payload?.total) || 0,
      page: Number(payload?.page) || page,
      pageSize: Number(payload?.pageSize) || pageSize,
    };
  } catch (error) {
    throw toError(error, 'Failed to fetch devices');
  }
}

/** GET /alarm-configuration/devices/ids */
export async function fetchPolicyDeviceIds({ search, tags, orgId, branchId, model } = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/alarm-configuration/devices/ids', {
      params: cleanParams({ search, tags, orgId, branchId, model }),
    });
    const payload = unwrap(data, 'Failed to fetch device ids');
    return {
      ids: Array.isArray(payload?.ids) ? payload.ids.map(String).filter(Boolean) : [],
      total: Number(payload?.total) || 0,
      truncated: Boolean(payload?.truncated),
    };
  } catch (error) {
    throw toError(error, 'Failed to fetch device ids');
  }
}

/** GET /alarm-configuration/:id */
export async function fetchAlarmPolicyById(id) {
  requireAuth();
  try {
    const { data } = await api.get(`/alarm-configuration/${encodeURIComponent(id)}`);
    return unwrap(data, 'Failed to fetch alarm policy');
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm policy');
  }
}

/** POST /alarm-configuration */
export async function createAlarmPolicy(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/alarm-configuration', payload);
    return unwrap(data, 'Failed to create alarm policy');
  } catch (error) {
    throw toError(error, 'Failed to create alarm policy');
  }
}

/** PUT /alarm-configuration/:id */
export async function updateAlarmPolicy(id, payload) {
  requireAuth();
  try {
    const { data } = await api.put(`/alarm-configuration/${encodeURIComponent(id)}`, payload);
    return unwrap(data, 'Failed to update alarm policy');
  } catch (error) {
    throw toError(error, 'Failed to update alarm policy');
  }
}

/** DELETE /alarm-configuration/:id */
export async function deleteAlarmPolicy(id) {
  requireAuth();
  try {
    const { data } = await api.delete(`/alarm-configuration/${encodeURIComponent(id)}`);
    return unwrap(data, 'Failed to delete alarm policy');
  } catch (error) {
    throw toError(error, 'Failed to delete alarm policy');
  }
}
