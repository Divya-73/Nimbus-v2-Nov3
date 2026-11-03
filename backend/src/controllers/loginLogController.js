import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { listLoginLogs } from '../queries/loginlogQueries.js';

function buildListSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    userId: String(req.user?.userId || req.user?.id || req.user?._id || '').trim(),
    email: String(req.user?.email || '').trim(),
    username: String(req.user?.email || req.user?.username || '').trim(),
  };
}

function collectFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of [
    'username',
    'ip',
    'userId',
    'orgId',
    'branchId',
    'status',
    'fromTime',
    'toTime',
    'search',
  ]) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

/** GET /api/v1/login-logs */
export async function listLogs(req, res) {
  try {
    const session = buildListSession(req);
    const filters = collectFilters(req);

    // Non–super-admins cannot widen scope via orgId/branchId query overrides
    if (!session.isSuperAdmin) {
      delete filters.orgId;
      delete filters.branchId;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);

    const data = await listLoginLogs({ ...filters, page, pageSize }, session);
    return success(res, data, 'Login logs retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch login logs', err.status || 500);
  }
}
