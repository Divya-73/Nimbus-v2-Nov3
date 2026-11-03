import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  createAlarmPolicy,
  deleteAlarmPolicy,
  getAlarmPolicyById,
  listAlarmPolicies,
  listPolicyDeviceIds,
  listPolicyDevices,
  updateAlarmPolicy,
} from '../queries/alarmConfigurationQueries.js';

function buildSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    role: String(scope.role || req.user?.role || '').trim(),
  };
}

function alarmConfigError(res, err, fallback) {
  return error(res, err.message || fallback, err.status || 500);
}

function collectListFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of ['orgId', 'branchId', 'search', 'tags', 'deviceId', 'model', 'ids']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  filters.page = q.page;
  filters.pageSize = q.pageSize;
  return filters;
}

/** GET /api/v1/alarm-configuration */
export async function listAlarmConfiguration(req, res) {
  try {
    const session = buildSession(req);
    const filters = collectListFilters(req);
    if (!session.isSuperAdmin) delete filters.orgId;
    const data = await listAlarmPolicies(filters, session);
    return success(res, data, 'Alarm policies retrieved successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to list alarm policies');
  }
}

/** GET /api/v1/alarm-configuration/devices */
export async function listAlarmConfigurationDevices(req, res) {
  try {
    const session = buildSession(req);
    const filters = collectListFilters(req);
    if (!session.isSuperAdmin) {
      delete filters.orgId;
      delete filters.branchId;
    }
    const data = await listPolicyDevices(filters, session);
    return success(res, data, 'Alarm policy devices retrieved successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to list alarm policy devices');
  }
}

/** GET /api/v1/alarm-configuration/devices/ids */
export async function listAlarmConfigurationDeviceIds(req, res) {
  try {
    const session = buildSession(req);
    const filters = collectListFilters(req);
    if (!session.isSuperAdmin) {
      delete filters.orgId;
      delete filters.branchId;
    }
    const data = await listPolicyDeviceIds(filters, session);
    return success(res, data, 'Alarm policy device ids retrieved successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to list alarm policy device ids');
  }
}

/** GET /api/v1/alarm-configuration/:id */
export async function getAlarmConfiguration(req, res) {
  try {
    const data = await getAlarmPolicyById(req.params.id, buildSession(req));
    return success(res, data, 'Alarm policy retrieved successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to fetch alarm policy');
  }
}

/** POST /api/v1/alarm-configuration */
export async function createAlarmConfiguration(req, res) {
  try {
    const data = await createAlarmPolicy(req.body || {}, buildSession(req));
    return success(res, data, 'Alarm policy created successfully', 201);
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to create alarm policy');
  }
}

/** PUT /api/v1/alarm-configuration/:id */
export async function updateAlarmConfiguration(req, res) {
  try {
    const data = await updateAlarmPolicy(req.params.id, req.body || {}, buildSession(req));
    return success(res, data, 'Alarm policy updated successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to update alarm policy');
  }
}

/** DELETE /api/v1/alarm-configuration/:id */
export async function deleteAlarmConfiguration(req, res) {
  try {
    const data = await deleteAlarmPolicy(req.params.id, buildSession(req));
    return success(res, data, 'Alarm policy deleted successfully');
  } catch (err) {
    return alarmConfigError(res, err, 'Failed to delete alarm policy');
  }
}
