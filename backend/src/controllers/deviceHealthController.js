import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceHealth } from '../queries/deviceHealthQueries.js';

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

/** GET /api/v1/performance/device/:id/health */
export async function deviceHealth(req, res) {
  try {
    const data = await getDeviceHealth(
      req.params.id,
      req.query.from,
      req.query.to,
      buildSession(req),
    );
    return success(res, data, 'Device health retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device health', failStatus(err));
  }
}
