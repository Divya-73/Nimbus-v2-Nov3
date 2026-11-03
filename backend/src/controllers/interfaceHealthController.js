import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getInterfaceHealth } from '../queries/interfaceHealthQueries.js';

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

/** GET /api/v1/performance/device/:id/interface-health */
export async function deviceInterfaceHealth(req, res) {
  try {
    const data = await getInterfaceHealth(
      req.params.id,
      req.query.from,
      req.query.to,
      req.query.iface,
      buildSession(req),
    );
    return success(res, data, 'Interface health retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch interface health', failStatus(err));
  }
}
