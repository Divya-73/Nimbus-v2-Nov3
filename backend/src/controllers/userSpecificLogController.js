import { success, error } from '../utils/response.js';
import { listUserSpecificLogs } from '../queries/userSpecificLogsQueries.js';

function buildListSession(req) {
  const scope = req.scope || {};
  return {
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    role: String(scope.role || req.user?.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || req.user?._id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function collectFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of ['uid', 'devId', 'task', 'type', 'status', 'fromTime', 'toTime', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

/** GET /api/v1/user-logs */
export async function listUserLogs(req, res) {
  try {
    const session = buildListSession(req);
    const filters = collectFilters(req);

    // Non–super-admins cannot query another user's uid
    if (!session.isSuperAdmin) {
      delete filters.uid;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);

    const data = await listUserSpecificLogs({ ...filters, page, pageSize }, session);
    return success(res, data, 'User specific logs retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch user specific logs', err.status || 500);
  }
}
