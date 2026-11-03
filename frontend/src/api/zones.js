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
 * GET /zones
 * @returns {{ total, data: ZoneRow[], appliedFilters }}
 */
export async function fetchZoneList({ orgId, region, zone, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, region, zone, search });
    const { data } = await api.get('/zones', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch zone list');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch zone list');
  }
}

/**
 * GET /zones/filters
 * @returns {{ organizations: [{ id, name }], regions: [{ name, count }] }}
 */
export async function fetchZoneFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/zones/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch zone filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch zone filter options');
  }
}

/**
 * GET /zones/:zone
 * @returns {{ zone, deviceCount, zoneStatus, zoneStatusColor, devices, appliedFilters }}
 */
export async function fetchZoneByName(zoneName, { orgId, region, search } = {}) {
  requireAuth();
  if (!zoneName || String(zoneName).trim() === '') {
    throw new Error('Zone name is required');
  }
  try {
    const params = cleanParams({ orgId, region, search });
    const { data } = await api.get(`/zones/${encodeURIComponent(String(zoneName).trim())}`, {
      params,
    });
    if (!data.success) throw new Error(data.message || 'Failed to fetch zone details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch zone details');
  }
}
