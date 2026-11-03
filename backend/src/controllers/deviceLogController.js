import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceLogs } from '../queries/deviceLogQueries.js';

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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

function collectFilters(req) {
  const q = req.query || {};
  const filters = {
    page: parsePositiveInt(q.page, 1),
    pageSize: Math.min(parsePositiveInt(q.pageSize, 10), 200),
  };
  for (const key of ['level', 'source', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

/** GET /api/v1/performance/device/:id/logs */
export async function deviceLogs(req, res) {
  try {
    const data = await getDeviceLogs(
      req.params.id,
      req.query.from,
      req.query.to,
      collectFilters(req),
      buildSession(req)
    );
    return success(res, data, 'Device logs retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device logs', failStatus(err));
  }
}
