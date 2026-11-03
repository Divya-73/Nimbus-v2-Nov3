import { success, error } from '../utils/response.js';
import { getActivityCutoff } from '../config/deviceStatusConfig.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getDashboardStats,
  getDeviceLocations,
  getUptimeWindows,
} from '../queries/dashboardQueries.js';
import {
  getAlarmLogs,
  getAlarmStats,
  getAlarmFilterOptions,
} from '../queries/alarmManagementQueries.js';

function parseActTime(req) {
  const raw = req.query?.actTime;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return getActivityCutoff();
}

/** GET /api/v1/dashboard/stats */
export async function stats(req, res) {
  try {
    const session = sessionFromReq(req);
    const actTime = parseActTime(req);
    const data = await getDashboardStats(session, actTime);
    return success(res, { stats: data, actTime }, 'Dashboard stats retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch dashboard statistics', 500);
  }
}

/** GET /api/v1/dashboard (same payload as stats) */
export async function getDashboard(req, res) {
  return stats(req, res);
}

/** GET /api/v1/dashboard/refresh */
export async function refreshDashboard(req, res) {
  try {
    const session = sessionFromReq(req);
    const actTime = getActivityCutoff();
    const data = await getDashboardStats(session, actTime);
    return success(
      res,
      { stats: data, actTime, timestamp: new Date().toISOString() },
      'Dashboard refreshed successfully'
    );
  } catch (err) {
    return error(res, err.message || 'Failed to refresh dashboard', 500);
  }
}

/** GET /api/v1/dashboard/alarms */
export async function getAlarmLogsController(req, res) {
  try {
    const session = sessionFromReq(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const filters = {};
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.org) filters.org = req.query.org;
    if (req.query.branch) filters.branch = req.query.branch;
    if (req.query.alarmType || req.query.type) {
      filters.alarmType = req.query.alarmType || req.query.type;
    }
    if (req.query.timeRange) filters.timeRange = req.query.timeRange;
    if (req.query.startTime) filters.startTime = parseInt(req.query.startTime, 10);
    if (req.query.endTime) filters.endTime = parseInt(req.query.endTime, 10);

    const result = await getAlarmLogs(limit, offset, filters, session);
    return success(res, result, 'Alarm logs retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarm logs', 500);
  }
}

/** GET /api/v1/dashboard/alarms/stats */
export async function getAlarmStatsController(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getAlarmStats(session);
    return success(res, data, 'Alarm statistics retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarm statistics', 500);
  }
}

/** GET /api/v1/dashboard/alarms/filters */
export async function getAlarmFilters(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getAlarmFilterOptions(session);
    return success(res, data, 'Alarm filter options retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch alarm filter options', 500);
  }
}

/** GET /api/v1/dashboard/map */
export async function getDeviceMap(req, res) {
  try {
    const session = sessionFromReq(req);
    const actTime = parseActTime(req);
    const data = await getDeviceLocations(session, actTime);

    return success(
      res,
      {
        devices: data.devices,
        total: data.total,
        upCount: data.upCount,
        downCount: data.downCount,
        onboardCount: data.onboardCount,
        actTime,
      },
      'Device locations retrieved successfully'
    );
  } catch (err) {
    return error(res, err.message || 'Failed to fetch device locations', 500);
  }
}

/** GET /api/v1/dashboard/uptime */
export async function getUptimeTrend(req, res) {
  try {
    const session = sessionFromReq(req);
    const data = await getUptimeWindows(session);
    return success(
      res,
      { ...data, generatedAt: new Date().toISOString() },
      'Uptime downtime buckets retrieved successfully'
    );
  } catch (err) {
    return error(res, err.message || 'Failed to fetch uptime trend', 500);
  }
}
