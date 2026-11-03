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
 * GET /performance
 */
export async function fetchLivePerformance({
  page = 1,
  pageSize = 5,
  orgId,
  branchId,
  org,
  branch,
  zone,
  region,
  model,
  search,
  status,
  sdwanStatus,
  lanStatus,
  lteStatus,
  lte1Status,
  lte2Status,
  wanStatus,
  sortBy,
  sortOrder,
} = {}) {
  requireAuth();
  try {
    const params = cleanParams({
      page,
      pageSize,
      orgId,
      branchId,
      org,
      branch,
      zone,
      region,
      model,
      search,
      status,
      sdwanStatus,
      lanStatus,
      lteStatus,
      lte1Status,
      lte2Status,
      wanStatus,
      sortBy,
      sortOrder,
    });

    const { data } = await api.get('/performance', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch live performance');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch live performance');
  }
}

/**
 * GET /performance/filters
 */
export async function fetchPerformanceFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/performance/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch performance filters');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch performance filters');
  }
}

/**
 * GET /performance/device/:id/health
 */
export async function fetchDeviceHealth(deviceId, { from, to } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/health`,
      { params: cleanParams({ from, to }) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch device health');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device health');
  }
}

/**
 * GET /performance/device/:id/traffic
 */
export async function fetchDeviceTraffic(deviceId, { from, to } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/traffic`,
      { params: cleanParams({ from, to }) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch device traffic');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device traffic');
  }
}

/** GET /performance/device/:id/link-health */
export async function fetchDeviceLinkHealth(deviceId, { from, to } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/link-health`,
      { params: cleanParams({ from, to }) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch link health');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch link health');
  }
}

/** GET /performance/device/:id/interface-health */
export async function fetchDeviceInterfaceHealth(deviceId, { from, to, iface } = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/interface-health`,
      { params: cleanParams({ from, to, iface }) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch interface health');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch interface health');
  }
}

async function fetchDeviceUsagePath(deviceId, path, fallback, range = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/${path}`,
      { params: cleanParams(range) }
    );
    if (!data.success) throw new Error(data.message || fallback);
    return data.data;
  } catch (error) {
    throw toError(error, fallback);
  }
}

/** GET /performance/device/:id/data-usage */
export function fetchDeviceDataUsage(deviceId, range = {}) {
  return fetchDeviceUsagePath(deviceId, 'data-usage', 'Failed to fetch data usage', range);
}

/** GET /performance/device/:id/ip-data-usage */
export function fetchDeviceIpUsage(deviceId, range = {}) {
  return fetchDeviceUsagePath(deviceId, 'ip-data-usage', 'Failed to fetch IP usage', range);
}

/** GET /performance/device/:id/alarms */
export async function fetchDeviceAlarms(deviceId, params = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/alarms`,
      { params: cleanParams(params) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch device alarms');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device alarms');
  }
}

/** GET /performance/device/:id/logs */
export async function fetchDeviceLogs(deviceId, params = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/logs`,
      { params: cleanParams(params) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch device logs');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device logs');
  }
}

/** GET /performance/device/:id/jobs */
export async function fetchDeviceJobs(deviceId, params = {}) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/jobs`,
      { params: cleanParams(params) }
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch device jobs');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch device jobs');
  }
}

/** GET /performance/device/:id/interface-map */
export async function fetchDeviceInterfaceMap(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/interface-map`
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch interface map');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch interface map');
  }
}

/** PUT /performance/device/:id/interface-map */
export async function saveDeviceInterfaceMap(deviceId, payload) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.put(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/interface-map`,
      payload
    );
    if (!data.success) throw new Error(data.message || 'Failed to save interface map');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to save interface map');
  }
}

/** GET /performance/device/:id/onboard-config */
export async function fetchDeviceOnboardConfig(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.get(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/onboard-config`
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch onboard config');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch onboard config');
  }
}

/** PUT /performance/device/:id/onboard-config */
export async function saveDeviceOnboardConfig(deviceId, payload) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.put(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}/onboard-config`,
      payload
    );
    if (!data.success) throw new Error(data.message || 'Failed to save onboard config');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to save onboard config');
  }
}

/** DELETE /performance/device/:id */
export async function deleteAssignedDevice(deviceId) {
  requireAuth();
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }
  try {
    const { data } = await api.delete(
      `/performance/device/${encodeURIComponent(String(deviceId).trim())}`,
      { timeout: 60000 }
    );
    if (!data.success) throw new Error(data.message || 'Failed to delete device');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete device');
  }
}

/** POST /performance/template-provision/preview */
export async function previewTemplateProvision(deviceIds = []) {
  requireAuth();
  const ids = [...new Set((deviceIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw new Error('Select at least one device');
  try {
    const { data } = await api.post('/performance/template-provision/preview', { deviceIds: ids });
    if (!data.success) throw new Error(data.message || 'Failed to preview template provision');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to preview template provision');
  }
}

/** POST /performance/template-provision */
export async function runTemplateProvision({ deviceIds = [], templateId, actName } = {}) {
  requireAuth();
  const ids = [...new Set((deviceIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw new Error('Select at least one device');
  if (!templateId) throw new Error('Select a template');
  try {
    const { data } = await api.post('/performance/template-provision', {
      deviceIds: ids,
      templateId,
      act_name: actName,
    });
    if (!data.success) throw new Error(data.message || 'Failed to provision template');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to provision template');
  }
}
