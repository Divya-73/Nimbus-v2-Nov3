import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getLivePerformance,
  getPerformanceFilterOptions,
} from '../queries/devicePerformanceQueries.js';

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function collectFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of [
    'orgId',
    'branchId',
    'org',
    'branch',
    'zone',
    'region',
    'model',
    'search',
    'status',
    'sdwanStatus',
    'lanStatus',
    'lteStatus',
    'lte1Status',
    'lte2Status',
    'wanStatus',
    'sortBy',
    'sortOrder',
  ]) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** GET /api/v1/performance */
export async function listLivePerformance(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectFilters(req);
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 5), 500);

    if (String(filters.status || '').toLowerCase() === 'onboard') {
      return success(
        res,
        { devices: [], total: 0, page, pageSize },
        'Onboard devices are listed under Provisioning, not Device Performance'
      );
    }

    const data = await getLivePerformance(filters, page, pageSize, session);
    return success(res, data, 'Live performance retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch live performance', err.status || 500);
  }
}

/** GET /api/v1/performance/filters */
export async function performanceFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getPerformanceFilterOptions(session);
    return success(res, data, 'Performance filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch performance filter options', err.status || 500);
  }
}
