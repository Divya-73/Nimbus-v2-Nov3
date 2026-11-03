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

function cleanParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str === '' || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

/**
 * GET /alarms
 * @returns {{ alarms, total, page, pageSize }}
 */
export async function fetchAlarms({
  page = 1,
  pageSize = 50,
  severity,
  state,
  org,
  branch,
  alarmType,
  objectLevel,
  policy,
  tags,
  host,
  siteId,
  devId,
  search,
  timeRange,
} = {}) {
  requireAuth();
  try {
    const params = cleanParams({
      page,
      pageSize,
      severity,
      state,
      org,
      branch,
      alarmType,
      objectLevel,
      policy,
      tags,
      host,
      siteId,
      devId,
      search,
      timeRange,
    });
    const { data } = await api.get('/alarms', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch alarms');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch alarms');
  }
}

/** Page through all matching alarms for export. */
export async function fetchAllAlarmsForExport(filters = {}, { pageSize = 500, maxPages = 40 } = {}) {
  const all = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPages && all.length < total) {
    const data = await fetchAlarms({ ...filters, page, pageSize });
    const batch = data.alarms || [];
    total = Number(data.total) || 0;
    all.push(...batch);
    if (!batch.length || all.length >= total) break;
    page += 1;
  }

  return { alarms: all, total };
}

/** GET /alarms/filters */
export async function fetchAlarmManageFilters() {
  requireAuth();
  try {
    const { data } = await api.get('/alarms/filters');
    if (!data.success) throw new Error(data.message || 'Failed to fetch alarm filters');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm filters');
  }
}

/** GET /alarms/stats */
export async function fetchAlarmManageStats(filters = {}) {
  requireAuth();
  try {
    const params = cleanParams(filters);
    const { data } = await api.get('/alarms/stats', { params });
    if (!data.success) throw new Error(data.message || 'Failed to fetch alarm stats');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch alarm stats');
  }
}

/** POST /alarms/:id/clear */
export async function clearAlarmLog(id) {
  requireAuth();
  const alarmId = String(id || '').trim();
  if (!alarmId) throw new Error('Alarm id is required');
  try {
    const { data } = await api.post(`/alarms/${encodeURIComponent(alarmId)}/clear`);
    if (!data.success) throw new Error(data.message || 'Failed to clear alarm');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to clear alarm');
  }
}

export function isAlarmCleared(status) {
  const key = String(status || '').toLowerCase();
  return key === 'cleared' || key === 'closed' || key === 'resolved';
}
