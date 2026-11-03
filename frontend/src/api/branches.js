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
 * GET /branches
 * @returns {{ total, data: BranchRow[], appliedFilters }}
 */
export async function fetchBranchList({ orgId, zone, region, search } = {}) {
  requireAuth();
  try {
    const params = cleanParams({ orgId, zone, region, search });
    const { data } = await api.get('/branches', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch branch list');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch branch list');
  }
}

/**
 * GET /branches/filters
 * @returns {{ organizations, zones, regions }}
 */
export async function fetchBranchFilterOptions(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/branches/filters', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch branch filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch branch filter options');
  }
}

/**
 * GET /branches/:id
 */
export async function fetchBranchById(branchId) {
  requireAuth();
  if (!branchId || String(branchId).trim() === '') {
    throw new Error('Branch id is required');
  }
  try {
    const { data } = await api.get(`/branches/${encodeURIComponent(String(branchId).trim())}`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch branch details');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch branch details');
  }
}

/**
 * GET /branches/manage — raw branch-index docs (super/org admin)
 * @returns {{ branches, total, page, pageSize }}
 */
export async function fetchManagedBranches({
  page = 1,
  pageSize = 50,
  search,
  orgId,
  zone,
  region,
} = {}) {
  requireAuth();
  try {
    const params = cleanParams({ page, pageSize, search, orgId, zone, region });
    const { data } = await api.get('/branches/manage', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch managed branches');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch managed branches');
  }
}

/** GET /branches/:id/doc */
export async function fetchBranchDoc(branchId) {
  requireAuth();
  if (!branchId || String(branchId).trim() === '') {
    throw new Error('Branch id is required');
  }
  try {
    const { data } = await api.get(`/branches/${encodeURIComponent(String(branchId).trim())}/doc`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch branch document');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch branch document');
  }
}

/** GET /branches/:id/counts */
export async function fetchBranchCounts(branchId) {
  requireAuth();
  if (!branchId || String(branchId).trim() === '') {
    throw new Error('Branch id is required');
  }
  try {
    const { data } = await api.get(
      `/branches/${encodeURIComponent(String(branchId).trim())}/counts`
    );
    if (!data.success) throw new Error(data.message || 'Failed to fetch branch counts');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch branch counts');
  }
}

/** POST /branches */
export async function createBranch(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/branches', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create branch');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create branch');
  }
}

/** PUT /branches/:id */
export async function updateBranch(branchId, payload) {
  requireAuth();
  if (!branchId || String(branchId).trim() === '') {
    throw new Error('Branch id is required');
  }
  try {
    const { data } = await api.put(
      `/branches/${encodeURIComponent(String(branchId).trim())}`,
      payload
    );
    if (!data.success) throw new Error(data.message || 'Failed to update branch');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to update branch');
  }
}

/** DELETE /branches/:id */
export async function deleteBranch(branchId) {
  requireAuth();
  if (!branchId || String(branchId).trim() === '') {
    throw new Error('Branch id is required');
  }
  try {
    const { data } = await api.delete(`/branches/${encodeURIComponent(String(branchId).trim())}`);
    if (!data.success) throw new Error(data.message || 'Failed to delete branch');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete branch');
  }
}
