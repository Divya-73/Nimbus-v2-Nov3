/** Alarm Management table columns (toggle; startTime locked). */
export const ALARM_COLUMNS = [
  { id: 'startTime', label: 'Start time', locked: true },
  { id: 'endTime', label: 'End time' },
  { id: 'severityLevel', label: 'Severity' },
  { id: 'alarmStatus', label: 'Status' },
  { id: 'hostname', label: 'Hostname' },
  { id: 'siteId', label: 'Site ID' },
  { id: 'organization', label: 'Organization' },
  { id: 'orgId', label: 'Org ID' },
  { id: 'branch', label: 'Branch' },
  { id: 'branchId', label: 'Branch ID' },
  { id: 'tags', label: 'Tags' },
  { id: 'policyName', label: 'Policy' },
  { id: 'alarmType', label: 'Alarm type' },
  { id: 'detail', label: 'Detail' },
  { id: 'objectType', label: 'Object level' },
  { id: 'devId', label: 'Device ID' },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  'startTime',
  'severityLevel',
  'alarmStatus',
  'hostname',
  'organization',
  'branch',
  'alarmType',
  'detail',
  'policyName',
  'objectType',
];

const STORAGE_KEY = 'nimbus.alarmManagement.visibleColumns';

export function loadVisibleColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMNS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_COLUMNS];
    const allowed = new Set(ALARM_COLUMNS.map((c) => c.id));
    const next = parsed.filter((id) => allowed.has(id));
    for (const col of ALARM_COLUMNS) {
      if (col.locked && !next.includes(col.id)) next.unshift(col.id);
    }
    return next.length ? next : [...DEFAULT_VISIBLE_COLUMNS];
  } catch {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }
}

export function saveVisibleColumns(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function orderedVisibleColumns(visibleIds) {
  const visible = new Set(visibleIds);
  return ALARM_COLUMNS.filter((c) => visible.has(c.id));
}
