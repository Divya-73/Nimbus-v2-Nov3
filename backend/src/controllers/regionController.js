import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getRegionList,
  getRegionByName,
  getRegionFilterOptions,
} from '../queries/regionlistQueries.js';

function collectRegionFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of ['orgId', 'zone', 'region', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** GET /api/v1/regions */
export async function listRegions(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectRegionFilters(req);
    const data = await getRegionList(filters, session);
    return success(res, data, 'Region list retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch region list', 500);
  }
}

/** GET /api/v1/regions/filters */
export async function regionFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getRegionFilterOptions(session);
    return success(res, data, 'Region filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch region filter options', 500);
  }
}

/** GET /api/v1/regions/:region — region detail + devices */
export async function regionByName(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectRegionFilters(req);
    const regionName = decodeURIComponent(String(req.params?.region || '').trim());

    if (!regionName) {
      return error(res, 'Region name is required', 400);
    }

    const result = await getRegionByName(regionName, filters, session);
    return success(res, result.data, 'Region details retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch region details', 500);
  }
}
