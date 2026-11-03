import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { deleteAssignedDevice } from '../queries/deviceDeleteQueries.js';

function buildSession(req) {
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(req.scope?.isSuperAdmin),
    isOrgAdmin: Boolean(req.scope?.isOrgAdmin),
    isBranchAdmin: Boolean(req.scope?.isBranchAdmin),
    role: String(req.user?.role || req.scope?.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
    username: String(req.user?.username || req.user?.email || '').trim(),
    sessionId: String(req.user?.sessionId || req.id || '').trim(),
  };
}

function failStatus(err) {
  if (err.status) return err.status;
  if (/not found/i.test(err.message || '')) return 404;
  if (/permission/i.test(err.message || '')) return 403;
  return 500;
}

/** DELETE /api/v1/performance/device/:id */
export async function removeAssignedDevice(req, res) {
  try {
    const data = await deleteAssignedDevice(req.params.id, buildSession(req));
    return success(res, data, 'Device deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete device', failStatus(err));
  }
}
