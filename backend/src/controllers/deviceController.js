import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceDetail, attachOrgBranchNames } from '../queries/deviceDetailQueries.js';

/** GET /api/v1/devices/:id — full device detail */
export async function deviceById(req, res) {
  try {
    const session = sessionFromReq(req);
    const deviceId = req.params?.id;
    const data = await attachOrgBranchNames(await getDeviceDetail(deviceId, session));
    return success(res, data, 'Device details retrieved successfully');
  } catch (err) {
    const msg = err.message || 'Failed to fetch device details';
    const status = /not found/i.test(msg) ? 404 : 500;
    return error(res, msg, status);
  }
}
