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
 * GET /models
 * @returns {{ total, data: ModelRow[], appliedFilters }}
 */
export async function fetchModelList({ orgId, zone, region, model, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, zone, region, model, search });
    const { data } = await api.get('/models', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch model list');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch model list');
  }
}

/**
 * GET /models/filters
 * @returns {{ organizations, zones, regions, models }}
 */
export async function fetchModelFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/models/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch model filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch model filter options');
  }
}

/**
 * GET /models/:model
 * @returns {{ model, manufacturer, deviceCount, status, devices, ... }}
 */
export async function fetchModelByName(modelName, { orgId, zone, region, search } = {}) {
  requireAuth();
  if (!modelName || String(modelName).trim() === '') {
    throw new Error('Model name is required');
  }
  try {
    const params = cleanParams({ orgId, zone, region, search });
    const { data } = await api.get(`/models/${encodeURIComponent(String(modelName).trim())}`, {
      params,
    });
    if (!data.success) throw new Error(data.message || 'Failed to fetch model details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch model details');
  }
}
