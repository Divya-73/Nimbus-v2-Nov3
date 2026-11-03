import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getZoneList,
  getZoneByName,
  getZoneFilterOptions,
} from '../queries/zonelistQueries.js';

function collectZoneFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of ['orgId', 'region', 'zone', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** GET /api/v1/zones */
export async function listZones(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectZoneFilters(req);
    const data = await getZoneList(filters, session);
    return success(res, data, 'Zone list retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch zone list', 500);
  }
}

/** GET /api/v1/zones/filters */
export async function zoneFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getZoneFilterOptions(session);
    return success(res, data, 'Zone filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch zone filter options', 500);
  }
}

/** GET /api/v1/zones/:zone — zone detail + devices */
export async function zoneByName(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectZoneFilters(req);
    const zoneName = decodeURIComponent(String(req.params?.zone || '').trim());

    if (!zoneName) {
      return error(res, 'Zone name is required', 400);
    }

    const result = await getZoneByName(zoneName, filters, session);
    return success(res, result.data, 'Zone details retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch zone details', 500);
  }
}
