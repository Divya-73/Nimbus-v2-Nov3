import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getBranchList,
  getBranchById,
  getBranchFilterOptions,
} from '../queries/branchlistQueries.js';
import {
  createBranchQuery,
  updateBranchQuery,
  deleteBranchQuery,
  getBranchCounts,
  getBranchDoc,
  listBranchDocs,
} from '../queries/branchManagementQueries.js';

function collectBranchFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of ['orgId', 'zone', 'region', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** Super admin or org admin may manage branches. */
function canManageBranches(scope = {}) {
  return Boolean(scope.isSuperAdmin || scope.isOrgAdmin);
}

/**
 * Org admins may only touch branches in their own org.
 * Super admins may touch any.
 */
function assertCanManageBranchOrg(scope = {}, branchOrgId = '') {
  if (scope.isSuperAdmin) return;
  const sessionOrg = String(scope.orgId || '').trim();
  const targetOrg = String(branchOrgId || '').trim();
  if (!sessionOrg || !targetOrg || sessionOrg !== targetOrg) {
    const err = new Error('You can only manage branches in your organisation');
    err.status = 403;
    throw err;
  }
}

/** GET /api/v1/branches */
export async function listBranches(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectBranchFilters(req);
    const data = await getBranchList(filters, session);
    return success(res, data, 'Branch list retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch branch list', err.status || 500);
  }
}

/** GET /api/v1/branches/filters */
export async function branchFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = {};
    if (req.query?.orgId != null && String(req.query.orgId).trim() !== '') {
      filters.orgId = String(req.query.orgId).trim();
    }
    const data = await getBranchFilterOptions(session, filters);
    return success(res, data, 'Branch filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch branch filter options', err.status || 500);
  }
}

/** GET /api/v1/branches/manage — raw branch-index docs for CRUD UI */
export async function listManagedBranches(req, res) {
  try {
    if (!canManageBranches(req.scope)) {
      return error(res, 'Org admin or super admin access required', 403);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 100, 1), 1000);
    const search = req.query.search != null ? String(req.query.search).trim() : '';
    const zone = req.query.zone != null ? String(req.query.zone).trim() : '';
    const region = req.query.region != null ? String(req.query.region).trim() : '';

    let orgId = req.query.orgId != null ? String(req.query.orgId).trim() : '';
    if (!req.scope?.isSuperAdmin) {
      orgId = String(req.scope?.orgId || '').trim();
      if (!orgId) return error(res, 'Organization scope is required', 403);
    }

    const data = await listBranchDocs({ page, pageSize, search, orgId, zone, region });
    return success(res, data, 'Managed branches retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch managed branches', err.status || 500);
  }
}

/** POST /api/v1/branches — create branch */
export async function createBranch(req, res) {
  try {
    if (!canManageBranches(req.scope)) {
      return error(res, 'Org admin or super admin access required', 403);
    }

    const body = { ...(req.body || {}) };
    if (!req.scope?.isSuperAdmin) {
      body.orgId = String(req.scope?.orgId || '').trim();
      if (!body.orgId) return error(res, 'Organization scope is required', 403);
    } else if (!String(body.orgId || '').trim()) {
      return error(res, 'Organization id is required', 400);
    }

    assertCanManageBranchOrg(req.scope, body.orgId);

    const data = await createBranchQuery(body);
    return success(res, data, 'Branch created successfully', 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create branch', err.status || 500);
  }
}

/** PUT /api/v1/branches/:id — update branch doc */
export async function updateBranch(req, res) {
  try {
    if (!canManageBranches(req.scope)) {
      return error(res, 'Org admin or super admin access required', 403);
    }

    const branchId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!branchId) return error(res, 'Branch id is required', 400);

    const existing = await getBranchDoc(branchId);
    assertCanManageBranchOrg(req.scope, existing.orgId);

    // Org admins cannot move a branch to another org
    const body = { ...(req.body || {}) };
    const allowOrgIdMove = Boolean(req.scope?.isSuperAdmin);
    if (!allowOrgIdMove) {
      delete body.orgId;
    } else if (body.orgId != null && String(body.orgId).trim()) {
      assertCanManageBranchOrg(req.scope, body.orgId);
    }

    const data = await updateBranchQuery(branchId, body, { allowOrgIdMove });
    return success(res, data, 'Branch updated successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to update branch', err.status || 500);
  }
}

/** DELETE /api/v1/branches/:id */
export async function deleteBranch(req, res) {
  try {
    if (!canManageBranches(req.scope)) {
      return error(res, 'Org admin or super admin access required', 403);
    }

    const branchId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!branchId) return error(res, 'Branch id is required', 400);

    const existing = await getBranchDoc(branchId);
    assertCanManageBranchOrg(req.scope, existing.orgId);

    const counts = await getBranchCounts(branchId);
    if (counts.totalLinked > 0) {
      return error(
        res,
        `Cannot delete branch: ${counts.devices} device(s) still linked`,
        409
      );
    }

    const data = await deleteBranchQuery(branchId);
    return success(res, data, 'Branch deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete branch', err.status || 500);
  }
}

/** GET /api/v1/branches/:id/counts */
export async function branchCounts(req, res) {
  try {
    const branchId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!branchId) return error(res, 'Branch id is required', 400);

    const existing = await getBranchDoc(branchId);
    if (!req.scope?.isSuperAdmin) {
      assertCanManageBranchOrg(req.scope, existing.orgId);
    }

    const data = await getBranchCounts(branchId);
    return success(res, data, 'Branch counts retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch branch counts', err.status || 500);
  }
}

/** GET /api/v1/branches/:id/doc — raw branch index document (management) */
export async function branchDocById(req, res) {
  try {
    if (!canManageBranches(req.scope)) {
      return error(res, 'Org admin or super admin access required', 403);
    }

    const branchId = decodeURIComponent(String(req.params?.id || '').trim());
    if (!branchId) return error(res, 'Branch id is required', 400);

    const data = await getBranchDoc(branchId);
    assertCanManageBranchOrg(req.scope, data.orgId);
    return success(res, data, 'Branch document retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch branch document', err.status || 500);
  }
}

/** GET /api/v1/branches/:id — branch detail + devices */
export async function branchById(req, res) {
  try {
    const session = sessionFromReq(req);
    const branchId = decodeURIComponent(String(req.params?.id || '').trim());

    if (!branchId) {
      return error(res, 'Branch id is required', 400);
    }

    const result = await getBranchById(branchId, session);
    return success(res, result.data, 'Branch details retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch branch details', err.status || 500);
  }
}
