/** Available live-performance table columns (user can toggle; hostname locked). */
export const PERF_COLUMNS = [
  { id: 'hostname', label: 'Hostname', locked: true },
  { id: 'org', label: 'Organization' },
  { id: 'branch', label: 'Branch' },
  { id: 'zone', label: 'Zone' },
  { id: 'region', label: 'Region' },
  { id: 'model', label: 'Model' },
  { id: 'version', label: 'Version' },
  { id: 'phase', label: 'Phase' },
  { id: 'tags', label: 'Tags' },
  { id: 'outletName', label: 'Outlet Name' },
  { id: 'sapCode', label: 'SAP Code' },
  { id: 'jdeCode', label: 'JDE Code' },
  { id: 'salesArea', label: 'Sales Area' },
  { id: 'automationVendor', label: 'Automation Vendor' },
  { id: 'status', label: 'Device Status' },
  { id: 'sdwanStatus', label: 'SD-WAN' },
  { id: 'lan', label: 'LAN' },
  { id: 'wan', label: 'WAN' },
  { id: 'lte', label: 'LTE' },
  { id: 'cpu', label: 'CPU %' },
  { id: 'memory', label: 'Mem %' },
  { id: 'uptime', label: 'Uptime' },
  { id: 'lastBoot', label: 'Last Boot' },
  { id: 'lastUpdated', label: 'Last Updated' },
  { id: 'dateCreated', label: 'Date Created' },
  { id: 'actions', label: 'Actions', locked: true },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  'hostname',
  'org',
  'branch',
  'sdwanStatus',
  'lan',
  'wan',
  'lte',
  'cpu',
  'memory',
  'uptime',
  'actions',
];

const STORAGE_KEY = 'nimbus.livePerformance.visibleColumns.v2';

export function loadVisibleColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMNS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_COLUMNS];
    const allowed = new Set(PERF_COLUMNS.map((c) => c.id));
    const hadOldWan = parsed.includes('wan1') || parsed.includes('wan2');
    const hadOldLte = parsed.includes('lte1') || parsed.includes('lte2');
    let next = parsed.filter((id) => allowed.has(id));
    for (const col of PERF_COLUMNS) {
      if (col.locked && !next.includes(col.id)) next.push(col.id);
    }
    if ((hadOldWan || (next.includes('lan') && hadOldLte)) && !next.includes('wan')) {
      const at = next.indexOf('lan') >= 0 ? next.indexOf('lan') + 1 : next.length;
      next.splice(at, 0, 'wan');
    }
    if ((hadOldLte || next.includes('wan')) && !next.includes('lte')) {
      const at = next.indexOf('wan') >= 0 ? next.indexOf('wan') + 1 : next.length;
      next.splice(at, 0, 'lte');
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
    /* ignore quota / private mode */
  }
}
