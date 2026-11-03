import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getLinkHealth } from '../queries/linkHealthQueries.js';

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

/** GET /api/v1/performance/device/:id/link-health */
export async function deviceLinkHealth(req, res) {
  try {
    const data = await getLinkHealth(
      req.params.id,
      req.query.from,
      req.query.to,
      buildSession(req),
    );
    return success(res, data, 'Link health retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch link health', failStatus(err));
  }
}
