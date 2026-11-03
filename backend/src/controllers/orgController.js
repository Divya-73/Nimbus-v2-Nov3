import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getOrgList,
  getOrgById,
  getOrgFilterOptions,
  getOrgHierarchy,
} from '../queries/orglistQueries.js';
import {
  createOrganizationQuery,
  updateOrganizationQuery,
  deleteOrganizationQuery,
  getOrgCounts,
  getOrganizationDoc,
  listOrganizationDocs,
} from '../queries/orgManagementQueries.js';

function collectOrgFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of ['orgId', 'zone', 'region', 'branch', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** GET /api/v1/orgs */
export async function listOrgs(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectOrgFilters(req);
    const data = await getOrgList(filters, session);
    return success(res, data, 'Organization list retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization list', err.status || 500);
  }
}

/** GET /api/v1/orgs/filters */
export async function orgFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getOrgFilterOptions(session);
    return success(res, data, 'Organization filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization filter options', err.status || 500);
  }
}

/** GET /api/v1/orgs/hierarchy — Org → Branch → Zone → Region → Devices */
export async function orgHierarchy(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectOrgFilters(req);
    const data = await getOrgHierarchy(filters, session);
    return success(res, data, 'Organization hierarchy retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization hierarchy', err.status || 500);
  }
}

/** GET /api/v1/orgs/manage — raw org-index docs for CRUD UI */
export async function listManagedOrgs(req, res) {
  try {
    if (!req.scope?.isSuperAdmin) {
      return error(res, 'Super admin access required', 403);
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 100, 1), 1000);
    const search = req.query.search != null ? String(req.query.search).trim() : '';
    const data = await listOrganizationDocs({ page, pageSize, search });
    return success(res, data, 'Managed organizations retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch managed organizations', err.status || 500);
  }
}

/** POST /api/v1/orgs — create organization */
export async function createOrg(req, res) {
  try {
    if (!req.scope?.isSuperAdmin) {
      return error(res, 'Super admin access required', 403);
    }
    const data = await createOrganizationQuery(req.body || {});
    return success(res, data, 'Organization created successfully', 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create organization', err.status || 500);
  }
}

/** PUT /api/v1/orgs/:orgId — update organization doc */
export async function updateOrg(req, res) {
  try {
    if (!req.scope?.isSuperAdmin) {
      return error(res, 'Super admin access required', 403);
    }
    const orgId = decodeURIComponent(String(req.params?.orgId || '').trim());
    if (!orgId) return error(res, 'Organization id is required', 400);
    const data = await updateOrganizationQuery(orgId, req.body || {});
    return success(res, data, 'Organization updated successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to update organization', err.status || 500);
  }
}

/** DELETE /api/v1/orgs/:orgId */
export async function deleteOrg(req, res) {
  try {
    if (!req.scope?.isSuperAdmin) {
      return error(res, 'Super admin access required', 403);
    }
    const orgId = decodeURIComponent(String(req.params?.orgId || '').trim());
    if (!orgId) return error(res, 'Organization id is required', 400);

    const counts = await getOrgCounts(orgId);
    if (counts.totalLinked > 0) {
      return error(
        res,
        `Cannot delete organization: ${counts.branches} branch(es), ${counts.devices} device(s) still linked`,
        409
      );
    }

    const data = await deleteOrganizationQuery(orgId);
    return success(res, data, 'Organization deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete organization', err.status || 500);
  }
}

/** GET /api/v1/orgs/:orgId/counts */
export async function orgCounts(req, res) {
  try {
    const orgId = decodeURIComponent(String(req.params?.orgId || '').trim());
    if (!orgId) return error(res, 'Organization id is required', 400);

    const session = sessionFromReq(req);
    if (!req.scope?.isSuperAdmin && session.orgId && session.orgId !== orgId) {
      return error(res, 'Access denied for this organization', 403);
    }

    const data = await getOrgCounts(orgId);
    return success(res, data, 'Organization counts retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization counts', err.status || 500);
  }
}

/** GET /api/v1/orgs/:orgId/doc — raw org index document (management) */
export async function orgDocById(req, res) {
  try {
    if (!req.scope?.isSuperAdmin) {
      return error(res, 'Super admin access required', 403);
    }
    const orgId = decodeURIComponent(String(req.params?.orgId || '').trim());
    if (!orgId) return error(res, 'Organization id is required', 400);
    const data = await getOrganizationDoc(orgId);
    return success(res, data, 'Organization document retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization document', err.status || 500);
  }
}

/** GET /api/v1/orgs/:orgId — org detail + devices */
export async function orgById(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectOrgFilters(req);
    const orgId = decodeURIComponent(String(req.params?.orgId || '').trim());

    if (!orgId) {
      return error(res, 'Organization id is required', 400);
    }

    const result = await getOrgById(orgId, filters, session);
    return success(res, result.data, 'Organization details retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch organization details', err.status || 500);
  }
}
