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
 * GET /regions
 * @returns {{ total, data: RegionRow[], appliedFilters }}
 */
export async function fetchRegionList({ orgId, zone, region, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, zone, region, search });
    const { data } = await api.get('/regions', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch region list');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch region list');
  }
}

/**
 * GET /regions/filters
 * @returns {{ organizations: [{ id, name }], zones: [{ name, count }] }}
 */
export async function fetchRegionFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/regions/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch region filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch region filter options');
  }
}

/**
 * GET /regions/:region
 * @returns {{ region, deviceCount, regionStatus, regionStatusColor, devices, appliedFilters }}
 */
export async function fetchRegionByName(regionName, { orgId, zone, search } = {}) {
  requireAuth();
  if (!regionName || String(regionName).trim() === '') {
    throw new Error('Region name is required');
  }
  try {
    const params = cleanParams({ orgId, zone, search });
    const { data } = await api.get(`/regions/${encodeURIComponent(String(regionName).trim())}`, {
      params,
    });
    if (!data.success) throw new Error(data.message || 'Failed to fetch region details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch region details');
  }
}
