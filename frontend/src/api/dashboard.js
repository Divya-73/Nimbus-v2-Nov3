import { api } from './auth';
import { getAccessToken } from '../utils/roleManagement';

function toError(error, fallback) {
  return new Error(error.response?.data?.message || error.message || fallback);
}

function requireAuth() {
  if (!getAccessToken()) {
    window.location.href = '/login';
    throw new Error('No access token found');
  }
}

/**
 * GET /dashboard/stats
 * @returns {{ stats, actTime }}
 */
export async function fetchDashboardStats(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/dashboard/stats', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch dashboard stats');
    // Backend: { data: { stats, actTime } }
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch dashboard stats');
  }
}

/**
 * GET /dashboard/refresh
 * @returns {{ stats, actTime, timestamp }}
 */
export async function refreshDashboardStats() {
  requireAuth();
  try {
    const { data } = await api.get('/dashboard/refresh');
    if (!data.success) throw new Error(data.message || 'Failed to refresh dashboard');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to refresh dashboard');
  }
}

/**
 * GET /dashboard/alarms
 * @returns {{ total, alarms }}
 */
export async function fetchAlarmLogs({
  severity = 'all',
  state = 'all',
  timeRange = '24h',
  org,
  branch,
  startTime,
  endTime,
  limit = 50,
  offset = 0,
} = {}) {
  requireAuth();
  try {
    const params = { limit, offset };
    if (severity && severity !== 'all') params.severity = severity;
    if (state && state !== 'all') params.state = state;
    if (timeRange && timeRange !== 'all') params.timeRange = timeRange;
    if (org) params.org = org;
    if (branch) params.branch = branch;
    if (startTime != null) params.startTime = startTime;
    if (endTime != null) params.endTime = endTime;

    const { data } = await api.get('/dashboard/alarms', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch alarm logs');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm logs');
  }
}

/**
 * GET /dashboard/alarms/filters
 * @returns {{ severities, states, types }}
 */
export async function fetchAlarmFilterOptions() {
  requireAuth();
  try {
    const { data } = await api.get('/dashboard/alarms/filters');
    if (!data.success) throw new Error(data.message || 'Failed to fetch filter options');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch filter options');
  }
}

/**
 * GET /dashboard/alarms/stats
 * @returns {{ bySeverity, byStatus, byType, recentTrend }}
 */
export async function fetchAlarmStats() {
  requireAuth();
  try {
    const { data } = await api.get('/dashboard/alarms/stats');
    if (!data.success) throw new Error(data.message || 'Failed to fetch alarm stats');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm stats');
  }
}

/**
 * GET /dashboard/map
 * @returns {{ devices, total, upCount, downCount, onboardCount, actTime }}
 */
let deviceMapCache = null;
let deviceMapPromise = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3000;

export async function fetchDeviceMap(params = {}) {
  requireAuth();

  const now = Date.now();
  if (deviceMapCache && now - cacheTimestamp < CACHE_DURATION) {
    return deviceMapCache;
  }
  if (deviceMapPromise) return deviceMapPromise;

  deviceMapPromise = api
    .get('/dashboard/map', { params })
    .then(({ data }) => {
      if (!data.success) throw new Error(data.message || 'Failed to fetch device map');
      deviceMapCache = data.data;
      cacheTimestamp = Date.now();
      return data.data;
    })
    .catch((error) => {
      throw toError(error, 'Failed to fetch device map');
    })
    .finally(() => {
      deviceMapPromise = null;
    });

  return deviceMapPromise;
}

/**
 * GET /dashboard/uptime
 * @returns {{ buckets, total, generatedAt }}
 * buckets: [{ key, label, count, devices: [{ hostname, organization, zone, region, lastSeen, downForSeconds }] }]
 */
export async function fetchUptimeTrend() {
  requireAuth();
  try {
    const { data } = await api.get('/dashboard/uptime');
    if (!data.success) throw new Error(data.message || 'Failed to fetch uptime trend');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch uptime trend');
  }
}
