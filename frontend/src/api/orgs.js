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
 * GET /orgs
 * @returns {{ total, data: OrgRow[], appliedFilters }}
 */
export async function fetchOrgList({ orgId, zone, region, branch, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, zone, region, branch, search });
    const { data } = await api.get('/orgs', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization list');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization list');
  }
}

/**
 * GET /orgs/filters
 * @returns {{ organizations, zones, regions, branches }}
 */
export async function fetchOrgFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/orgs/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization filter options');
  }
}

/**
 * GET /orgs/:orgId
 */
export async function fetchOrgById(orgId, { zone, region, branch, search } = {}) {
  requireAuth();
  if (!orgId || String(orgId).trim() === '') {
    throw new Error('Organization id is required');
  }
  try {
    const params = cleanParams({ zone, region, branch, search });
    const { data } = await api.get(`/orgs/${encodeURIComponent(String(orgId).trim())}`, {
      params,
    });
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization details');
  }
}

/**
 * GET /orgs/hierarchy — Org → Branch → Zone → Region → Devices
 */
export async function fetchOrgHierarchy({ orgId, zone, region, branch, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, zone, region, branch, search });
    const { data } = await api.get('/orgs/hierarchy', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization hierarchy');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization hierarchy');
  }
}

/**
 * GET /orgs/manage — raw org-index docs (super admin)
 * @returns {{ organizations, total, page, pageSize }}
 */
export async function fetchManagedOrgs({ page = 1, pageSize = 50, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ page, pageSize, search });
    const { data } = await api.get('/orgs/manage', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch managed organizations');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch managed organizations');
  }
}

/** GET /orgs/:orgId/doc */
export async function fetchOrgDoc(orgId) {
  requireAuth();
  if (!orgId || String(orgId).trim() === '') {
    throw new Error('Organization id is required');
  }
  try {
    const { data } = await api.get(`/orgs/${encodeURIComponent(String(orgId).trim())}/doc`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization document');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization document');
  }
}

/** GET /orgs/:orgId/counts */
export async function fetchOrgCounts(orgId) {
  requireAuth();
  if (!orgId || String(orgId).trim() === '') {
    throw new Error('Organization id is required');
  }
  try {
    const { data } = await api.get(`/orgs/${encodeURIComponent(String(orgId).trim())}/counts`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch organization counts');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch organization counts');
  }
}

/** POST /orgs */
export async function createOrg(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/orgs', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create organization');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create organization');
  }
}

/** PUT /orgs/:orgId */
export async function updateOrg(orgId, payload) {
  requireAuth();
  if (!orgId || String(orgId).trim() === '') {
    throw new Error('Organization id is required');
  }
  try {
    const { data } = await api.put(
      `/orgs/${encodeURIComponent(String(orgId).trim())}`,
      payload
    );
    if (!data.success) throw new Error(data.message || 'Failed to update organization');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to update organization');
  }
}

/** DELETE /orgs/:orgId */
export async function deleteOrg(orgId) {
  requireAuth();
  if (!orgId || String(orgId).trim() === '') {
    throw new Error('Organization id is required');
  }
  try {
    const { data } = await api.delete(`/orgs/${encodeURIComponent(String(orgId).trim())}`);
    if (!data.success) throw new Error(data.message || 'Failed to delete organization');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete organization');
  }
}
