import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getDataUsage,
  getIpDataUsage,
} from '../queries/dataUsageQueries.js';

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

function parsePoint(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/** GET /api/v1/performance/device/:id/data-usage */
export async function deviceDataUsage(req, res) {
  try {
    const data = await getDataUsage(
      req.params.id,
      req.query.from,
      req.query.to,
      buildSession(req),
      parsePoint(req.query.point),
    );
    return success(res, data, 'Data usage retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch data usage', failStatus(err));
  }
}

/** GET /api/v1/performance/device/:id/ip-data-usage */
export async function deviceIpDataUsage(req, res) {
  try {
    const data = await getIpDataUsage(
      req.params.id,
      req.query.from,
      req.query.to,
      buildSession(req),
    );
    return success(res, data, 'IP data usage retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch IP data usage', failStatus(err));
  }
}
