import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  clearAlarmLog,
  getAlarmLogs,
  getAlarmFilterOptions,
  getAlarmStats,
} from '../queries/alarmManagementQueries.js';

function buildSession(req) {
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(req.scope?.isSuperAdmin),
    isOrgAdmin: Boolean(req.scope?.isOrgAdmin),
    isBranchAdmin: Boolean(req.scope?.isBranchAdmin),
    role: String(req.scope?.role || req.user?.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function collectAlarmFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of [
    'severity',
    'state',
    'org',
    'branch',
    'alarmType',
    'type',
    'objectLevel',
    'olevel',
    'policy',
    'tags',
    'host',
    'hostname',
    'siteId',
    'devId',
    'search',
    'timeRange',
  ]) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

/** GET /api/v1/alarms */
export async function listAlarms(req, res) {
  try {
    const session = buildSession(req);
    const filters = collectAlarmFilters(req);

    // Non–super-admins cannot widen org/branch via query
    if (!session.isSuperAdmin) {
      delete filters.org;
      delete filters.branch;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || pageSize, 1), 500);
    const offset =
      req.query.offset != null
        ? Math.max(parseInt(req.query.offset, 10) || 0, 0)
        : (page - 1) * pageSize;

    const data = await getAlarmLogs(
      limit,
      offset,
      { ...filters, page, pageSize },
      session
    );
    return success(res, data, 'Alarms retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarms', err.status || 500);
  }
}

/** GET /api/v1/alarms/filters */
export async function alarmFilters(req, res) {
  try {
    const session = buildSession(req);
    const data = await getAlarmFilterOptions(session);
    return success(res, data, 'Alarm filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarm filters', err.status || 500);
  }
}

/** GET /api/v1/alarms/stats */
export async function alarmStats(req, res) {
  try {
    const session = buildSession(req);
    const filters = collectAlarmFilters(req);
    if (!session.isSuperAdmin) {
      delete filters.org;
      delete filters.branch;
    }
    const data = await getAlarmStats(session, filters);
    return success(res, data, 'Alarm statistics retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarm statistics', err.status || 500);
  }
}

/** POST /api/v1/alarms/:id/clear */
export async function clearAlarm(req, res) {
  try {
    const data = await clearAlarmLog(req.params.id, buildSession(req));
    return success(res, data, data?.alreadyCleared ? 'Alarm already cleared' : 'Alarm cleared successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to clear alarm', err.status || 500);
  }
}
