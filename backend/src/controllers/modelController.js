import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getModelList,
  getModelByName,
  getModelFilterOptions,
} from '../queries/modellistQueries.js';

function collectModelFilters(req) {
  const q = req.query || {};
  const filters = {};

  for (const key of ['orgId', 'zone', 'region', 'model', 'search']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }

  return filters;
}

/** GET /api/v1/models */
export async function listModels(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectModelFilters(req);
    const data = await getModelList(filters, session);
    return success(res, data, 'Model list retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch model list', err.status || 500);
  }
}

/** GET /api/v1/models/filters */
export async function modelFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getModelFilterOptions(session);
    return success(res, data, 'Model filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch model filter options', err.status || 500);
  }
}

/** GET /api/v1/models/:model — model detail + devices */
export async function modelByName(req, res) {
  try {
    const session = sessionFromReq(req);
    const filters = collectModelFilters(req);
    const modelName = decodeURIComponent(String(req.params?.model || '').trim());

    if (!modelName) {
      return error(res, 'Model name is required', 400);
    }

    const result = await getModelByName(modelName, filters, session);
    return success(res, result.data, 'Model details retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch model details', err.status || 500);
  }
}
