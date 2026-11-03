import { success, error } from '../utils/response.js';
import { USER_ROLES } from '../config/databaseConfig.js';
import {
  listAccountDocs,
  getAccountDoc,
  createAccountQuery,
  updateAccountQuery,
  deleteAccountQuery,
} from '../queries/accountManagementQueries.js';

/** Super admin or org admin may manage accounts. */
function canManageAccounts(scope = {}) {
  return Boolean(scope.isSuperAdmin || scope.isOrgAdmin);
}

function assertCanManageAccounts(scope = {}) {
  if (!canManageAccounts(scope)) {
    const err = new Error('Org admin or super admin access required');
    err.status = 403;
    throw err;
  }
}

/**
 * Org admins may only touch accounts in their own org.
 * Super admins may touch any.
 */
function assertCanManageAccountOrg(scope = {}, accountOrgId = '') {
  if (scope.isSuperAdmin) return;
  const sessionOrg = String(scope.orgId || '').trim();
  const targetOrg = String(accountOrgId || '').trim();
  if (!sessionOrg || !targetOrg || sessionOrg !== targetOrg) {
    const err = new Error('You can only manage accounts in your organisation');
    err.status = 403;
    throw err;
  }
}

/** Org admins cannot assign or edit Super Admin accounts. */
function assertAssignableRole(scope = {}, role = '') {
  if (scope.isSuperAdmin) return;
  const r = String(role || '').trim();
  if (r === USER_ROLES.SUPER_ADMIN || r === '99' || r === 'super_admin') {
    const err = new Error('You cannot assign the super admin role');
    err.status = 403;
    throw err;
  }
}

function collectAccountFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of ['orgId', 'branchId', 'role', 'active', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

function currentUserId(req) {
  return String(req.user?.userId || req.user?.id || req.user?._id || '').trim();
}

/** GET /api/v1/accounts */
export async function listAccounts(req, res) {
  try {
    assertCanManageAccounts(req.scope);

    const filters = collectAccountFilters(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 1000);

    if (!req.scope?.isSuperAdmin) {
      filters.orgId = String(req.scope?.orgId || '').trim();
      if (!filters.orgId) return error(res, 'Organization scope is required', 403);
    }

    const data = await listAccountDocs({ ...filters, page, pageSize });
    return success(res, data, 'Accounts retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch accounts', err.status || 500);
  }
}

/** GET /api/v1/accounts/:id */
export async function accountById(req, res) {
  try {
    assertCanManageAccounts(req.scope);

    const accountId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!accountId) return error(res, 'Account id is required', 400);

    const data = await getAccountDoc(accountId);
    assertCanManageAccountOrg(req.scope, data.orgId);

    return success(res, data, 'Account retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch account', err.status || 500);
  }
}

/** POST /api/v1/accounts */
export async function createAccount(req, res) {
  try {
    assertCanManageAccounts(req.scope);

    const body = { ...(req.body || {}) };

    if (!req.scope?.isSuperAdmin) {
      body.orgId = String(req.scope?.orgId || '').trim();
      if (!body.orgId) return error(res, 'Organization scope is required', 403);
    } else if (!String(body.orgId || '').trim() && String(body.role) !== USER_ROLES.SUPER_ADMIN) {
      // Non–super-admin accounts should belong to an org (soft requirement for others)
    }

    assertCanManageAccountOrg(req.scope, body.orgId || req.scope?.orgId);
    assertAssignableRole(req.scope, body.role);

    const data = await createAccountQuery(body);
    return success(res, data, 'Account created successfully', 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create account', err.status || 500);
  }
}

/** PUT /api/v1/accounts/:id */
export async function updateAccount(req, res) {
  try {
    assertCanManageAccounts(req.scope);

    const accountId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!accountId) return error(res, 'Account id is required', 400);

    const existing = await getAccountDoc(accountId);
    assertCanManageAccountOrg(req.scope, existing.orgId);

    // Org admins cannot edit a Super Admin account
    assertAssignableRole(req.scope, existing.role);

    const body = { ...(req.body || {}) };

    if (!req.scope?.isSuperAdmin) {
      // Cannot move account to another org or escalate to super admin
      delete body.orgId;
      assertAssignableRole(req.scope, body.role);
    } else if (body.orgId != null && String(body.orgId).trim()) {
      assertCanManageAccountOrg(req.scope, body.orgId);
    }

    if (body.role != null) {
      assertAssignableRole(req.scope, body.role);
    }

    const data = await updateAccountQuery(accountId, body);
    return success(res, data, 'Account updated successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to update account', err.status || 500);
  }
}

/** DELETE /api/v1/accounts/:id */
export async function deleteAccount(req, res) {
  try {
    assertCanManageAccounts(req.scope);

    const accountId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!accountId) return error(res, 'Account id is required', 400);

    if (currentUserId(req) && currentUserId(req) === accountId) {
      return error(res, 'You cannot delete your own account', 400);
    }

    const existing = await getAccountDoc(accountId);
    assertCanManageAccountOrg(req.scope, existing.orgId);
    assertAssignableRole(req.scope, existing.role);

    const data = await deleteAccountQuery(accountId);
    return success(res, data, 'Account deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete account', err.status || 500);
  }
}
