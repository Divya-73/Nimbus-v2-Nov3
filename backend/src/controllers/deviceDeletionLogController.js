import { success, error } from '../utils/response.js';
import { listDeviceDeletionLogs } from '../queries/deviceDeletionLogsQueries.js';

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
  for (const key of [
    'username',
    'sysname',
    'sessionId',
    'userId',
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

/** GET /api/v1/device-deletion-logs */
export async function listDeviceDeletionLogEntries(req, res) {
  try {
    const session = buildListSession(req);
    const filters = collectFilters(req);

    // Non–super-admins cannot query another user's logs
    if (!session.isSuperAdmin) {
      delete filters.userId;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);

    const data = await listDeviceDeletionLogs({ ...filters, page, pageSize }, session);
    return success(res, data, 'Device deletion logs retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device deletion logs', err.status || 500);
  }
}
