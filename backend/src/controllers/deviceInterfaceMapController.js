import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getDeviceInterfaceMap,
  getDeviceOnboardConfig,
  updateDeviceInterfaceMap,
  updateDeviceOnboardConfig,
} from '../queries/deviceInterfaceMapQueries.js';

function buildSession(req) {
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(req.scope?.isSuperAdmin),
    isOrgAdmin: Boolean(req.scope?.isOrgAdmin),
    isBranchAdmin: Boolean(req.scope?.isBranchAdmin),
    role: String(req.user?.role || req.scope?.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function failStatus(err) {
  if (err.status) return err.status;
  if (/not found/i.test(err.message || '')) return 404;
  return 500;
}

/** GET /api/v1/performance/device/:id/interface-map */
export async function deviceInterfaceMap(req, res) {
  try {
    const data = await getDeviceInterfaceMap(req.params.id, buildSession(req));
    return success(res, data, 'Device assignment retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device assignment', failStatus(err));
  }
}

/** PUT /api/v1/performance/device/:id/interface-map */
export async function saveDeviceInterfaceMap(req, res) {
  try {
    const data = await updateDeviceInterfaceMap(
      req.params.id,
      req.body || {},
      buildSession(req)
    );
    return success(res, data, 'Device assignment saved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to save device assignment', failStatus(err));
  }
}

/** GET /api/v1/performance/device/:id/onboard-config */
export async function deviceOnboardConfig(req, res) {
  try {
    const data = await getDeviceOnboardConfig(req.params.id, buildSession(req));
    return success(res, data, 'Device onboard config retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device onboard config', failStatus(err));
  }
}

/** PUT /api/v1/performance/device/:id/onboard-config */
export async function saveDeviceOnboardConfig(req, res) {
  try {
    const data = await updateDeviceOnboardConfig(
      req.params.id,
      req.body || {},
      buildSession(req)
    );
    return success(res, data, 'Device onboard config saved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to save device onboard config', failStatus(err));
  }
}
