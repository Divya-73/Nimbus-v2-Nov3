import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceTraffic } from '../queries/trafficQueries.js';

function buildSession(req) {
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(req.scope?.isSuperAdmin),
  };
}

function failStatus(err) {
  if (err.status) return err.status;
  if (/not found/i.test(err.message || '')) return 404;
  return 500;
}

/** GET /api/v1/performance/device/:id/traffic */
export async function deviceTraffic(req, res) {
  try {
    const data = await getDeviceTraffic(
      req.params.id,
      req.query.from,
      req.query.to,
      buildSession(req),
    );
    return success(res, data, 'Device traffic retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device traffic', failStatus(err));
  }
}
