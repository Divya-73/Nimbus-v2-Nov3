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
    // Allow "0" (e.g. inactive status / role edge cases)
    if (str === '' || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

/**
 * GET /accounts
 * @returns {{ accounts, total, page, pageSize }}
 */
export async function fetchAccounts({
  page = 1,
  pageSize = 50,
  search,
  orgId,
  branchId,
  role,
  active,
} = {}) {
  requireAuth();
  try {
    const params = cleanParams({ page, pageSize, search, orgId, branchId, role, active });
    const { data } = await api.get('/accounts', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch accounts');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch accounts');
  }
}

/** GET /accounts/:id */
export async function fetchAccountById(accountId) {
  requireAuth();
  if (!accountId || String(accountId).trim() === '') {
    throw new Error('Account id is required');
  }
  try {
    const { data } = await api.get(`/accounts/${encodeURIComponent(String(accountId).trim())}`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch account');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch account');
  }
}

/** POST /accounts */
export async function createAccount(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/accounts', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create account');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create account');
  }
}

/** PUT /accounts/:id */
export async function updateAccount(accountId, payload) {
  requireAuth();
  if (!accountId || String(accountId).trim() === '') {
    throw new Error('Account id is required');
  }
  try {
    const { data } = await api.put(
      `/accounts/${encodeURIComponent(String(accountId).trim())}`,
      payload
    );
    if (!data.success) throw new Error(data.message || 'Failed to update account');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to update account');
  }
}

/** DELETE /accounts/:id */
export async function deleteAccount(accountId) {
  requireAuth();
  if (!accountId || String(accountId).trim() === '') {
    throw new Error('Account id is required');
  }
  try {
    const { data } = await api.delete(
      `/accounts/${encodeURIComponent(String(accountId).trim())}`
    );
    if (!data.success) throw new Error(data.message || 'Failed to delete account');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete account');
  }
}
