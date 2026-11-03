import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  assignOnboardDevices,
  deleteOnboardDevice,
  getOnboardDevice,
  getOnboardDevices,
} from '../queries/onboardQueries.js';

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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
  return 500;
}

/** GET /api/v1/onboard */
export async function listOnboardDevices(req, res) {
  try {
    const q = req.query || {};
    const filters = {};
    for (const key of ['search', 'model']) {
      if (q[key] != null && String(q[key]).trim() !== '') {
        filters[key] = String(q[key]).trim();
      }
    }

    const page = parsePositiveInt(q.page, 1);
    const pageSize = Math.min(parsePositiveInt(q.pageSize, 10), 500);

    const data = await getOnboardDevices(filters, page, pageSize);
    return success(res, data, 'Onboard devices retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch onboard devices', failStatus(err));
  }
}

/** GET /api/v1/onboard/:id */
export async function onboardDeviceById(req, res) {
  try {
    const data = await getOnboardDevice(req.params.id);
    return success(res, data, 'Onboard device retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch onboard device', failStatus(err));
  }
}

/** POST /api/v1/onboard/assign */
export async function assignOnboard(req, res) {
  try {
    const data = await assignOnboardDevices(req.body || {}, buildSession(req));
    return success(res, data, 'Device assigned successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to assign onboard device', failStatus(err));
  }
}

/** DELETE /api/v1/onboard/:id */
export async function removeOnboardDevice(req, res) {
  try {
    const data = await deleteOnboardDevice(req.params.id, buildSession(req));
    return success(res, data, 'Onboard device deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete onboard device', failStatus(err));
  }
}
