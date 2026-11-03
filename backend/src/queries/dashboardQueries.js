import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  ACTIVITY_WINDOW_SECONDS,
  DEVICE_STATUS,
  IFACE_STATUS,
  buildSessionFilters,
  getActivityCutoff,
  getDeviceStatus,
  getLanInterfaceStatus,
  getLteInterfaceStatus,
  getCpuPercent,
  getMemoryUsagePercent,
  isAssigned,
  isOnline,
} from '../config/deviceStatusConfig.js';
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';
import { fetchOrgNamesByIds, resolveOrgName } from './orgNameLookup.js';
import { fetchScopedCatalogOrgIds } from './orglistQueries.js';

/** Lean _source for dashboard tallies — carriers only, not full iftrans_temp. */
const DASHBOARD_SOURCE = {
  includes: [
    'slu',
    'lastupdated',
    'orgId',
    'branchId',
    'org',
    'branch',
    'zone',
    'region',
    'SIM1',
    'SIM2',
    'LAN1',
    'WAN1',
    'WAN2',
    'WAN3',
    'WAN4',
    'WAN5',
    'WAN6',
    'WAN7',
    'SSTP',
    'iftrans_temp.*.carrier',
  ],
};

/** Lean _source for map pins. */
const MAP_SOURCE_FIELDS = [
  'sysname',
  'org',
  'zone',
  'region',
  'model',
  'lat',
  'long',
  'slu',
  'lastupdated',
  'orgId',
  'branchId',
  'cpu.per',
  'mem.mper',
  'branch',
];

/** Fields for downtime-duration bucketing (assigned devices). */
const UPTIME_SOURCE_FIELDS = [
  'sysname',
  'slu',
  'lastupdated',
  'orgId',
  'branchId',
  'org',
  'zone',
  'region',
];

/**
 * Exclusive downtime-duration buckets (manager chart).
 * Each assigned device lands in exactly one bucket:
 *   Up → currently online (activity window)
 *   Down(X) → offline, last-seen age falls in that exclusive range
 */
const DOWNTIME_BUCKETS = Object.freeze([
  { key: 'up', label: 'Up', maxSeconds: null },
  { key: 'down_10m', label: 'Down(10 Min)', maxSeconds: 600 },
  { key: 'down_30m', label: 'Down(30 Min)', maxSeconds: 1800 },
  { key: 'down_2h', label: 'Down(2 Hr)', maxSeconds: 7200 },
  { key: 'down_4h', label: 'Down(4 Hr)', maxSeconds: 14400 },
  { key: 'down_8h', label: 'Down(8 Hr)', maxSeconds: 28800 },
  { key: 'down_1d', label: 'Down(1 Day)', maxSeconds: 86400 },
  { key: 'down_3d', label: 'Down(3 Day)', maxSeconds: 259200 },
  { key: 'down_7d', label: 'Down(7 Day)', maxSeconds: 604800 },
  { key: 'down_1M', label: 'Down(1 Month)', maxSeconds: 2592000 },
  { key: 'down_gt_1M', label: 'Down(> 1 Month)', maxSeconds: Infinity },
]);

function lastSeenEpoch(device = {}) {
  const slu = Number(device.slu);
  const lu = Number(device.lastupdated);
  return Math.max(Number.isFinite(slu) ? slu : 0, Number.isFinite(lu) ? lu : 0);
}

function downtimeBucketKey(ageSeconds, online) {
  if (online) return 'up';
  const age = Math.max(0, Number(ageSeconds) || 0);
  for (const bucket of DOWNTIME_BUCKETS) {
    if (bucket.key === 'up') continue;
    if (age <= bucket.maxSeconds) return bucket.key;
  }
  return 'down_gt_1M';
}

function emptyIface() {
  return { up: 0, down: 0, na: 0, total: 0 };
}

function bumpIface(bucket, status) {
  if (status === IFACE_STATUS.UP) bucket.up += 1;
  else if (status === IFACE_STATUS.DOWN) bucket.down += 1;
  else bucket.na += 1;
  bucket.total += 1;
}

function bumpGroup(map, key, deviceStatus, extra = {}) {
  if (!key) return;
  let row = map.get(key);
  if (!row) {
    row = { up: 0, down: 0, onboard: 0, total: 0, ...extra };
    map.set(key, row);
  } else {
    // Fill ids if later docs have them and the first didn't
    for (const [k, v] of Object.entries(extra)) {
      if (row[k] == null && v != null) row[k] = v;
    }
  }
  row.total += 1;
  if (deviceStatus === DEVICE_STATUS.UP) row.up += 1;
  else if (deviceStatus === DEVICE_STATUS.DOWN) row.down += 1;
  else if (deviceStatus === DEVICE_STATUS.ONBOARD) row.onboard += 1;
}

function mapToList(map, labelKey) {
  return [...map.entries()]
    .map(([key, counts]) => ({ [labelKey]: key, ...counts }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Dashboard KPIs — lean fetch + JS status from deviceStatusConfig.
 */
export async function getDashboardStats(session = {}, actTime) {
  const cutoff = actTime ?? getActivityCutoff(ACTIVITY_WINDOW_SECONDS);
  const filters = buildSessionFilters(session);
  const query = filters.length ? { bool: { filter: filters } } : { match_all: {} };

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 10000,
      track_total_hits: true,
      query,
      _source: DASHBOARD_SOURCE,
    },
  });

  const hits = body.hits?.hits || [];
  const [branchNamesById, orgNamesById] = await Promise.all([
    fetchBranchNamesByIds(hits.map((h) => h._source?.branchId).filter(Boolean)),
    fetchOrgNamesByIds(hits.map((h) => h._source?.orgId).filter(Boolean)),
  ]);

  const lte1 = emptyIface();
  const lte2 = emptyIface();
  const lan = emptyIface();
  const deviceStatus = { up: 0, down: 0, onboard: 0 };
  const orgs = new Map();
  const branches = new Map();
  const zones = new Map();
  const regions = new Map();
  const orgIds = new Set();
  const branchIds = new Set();
  const zoneKeys = new Set();
  const regionKeys = new Set();

  for (const hit of hits) {
    const d = hit._source || {};
    const status = getDeviceStatus(d, cutoff);

    if (status === DEVICE_STATUS.UP) deviceStatus.up += 1;
    else if (status === DEVICE_STATUS.DOWN) deviceStatus.down += 1;
    else if (status === DEVICE_STATUS.ONBOARD) deviceStatus.onboard += 1;

    // Match org list: count assigned UP/DOWN orgIds only (not stray/unassigned orgIds)
    if (
      isAssigned(d) &&
      (status === DEVICE_STATUS.UP || status === DEVICE_STATUS.DOWN) &&
      d.orgId
    ) {
      orgIds.add(String(d.orgId));
    }
    if (d.branchId) branchIds.add(String(d.branchId));
    if (d.zone) zoneKeys.add(String(d.zone));
    if (d.region) regionKeys.add(String(d.region));

    bumpIface(lte1, getLteInterfaceStatus(d, 'SIM1', cutoff));
    bumpIface(lte2, getLteInterfaceStatus(d, 'SIM2', cutoff));
    bumpIface(lan, getLanInterfaceStatus(d, cutoff));

    // Prefer org-index name by orgId; if blank device.org, still roll into the org
    const orgName = resolveOrgName(d, orgNamesById);
    if (
      orgName &&
      (status === DEVICE_STATUS.UP ||
        status === DEVICE_STATUS.DOWN ||
        status === DEVICE_STATUS.ONBOARD)
    ) {
      bumpGroup(orgs, orgName, status, d.orgId ? { orgId: String(d.orgId) } : {});
    }

    // Prefer device.branch; if blank, use branch-index name for branchId
    const branchName = resolveBranchName(d, branchNamesById);
    if (
      branchName &&
      (status === DEVICE_STATUS.UP ||
        status === DEVICE_STATUS.DOWN ||
        status === DEVICE_STATUS.ONBOARD)
    ) {
      bumpGroup(branches, branchName, status, d.branchId ? { branchId: String(d.branchId) } : {});
    }
    bumpGroup(zones, d.zone, status);
    bumpGroup(regions, d.region, status);
  }

  // Match org list: include catalog orgs that have zero devices
  try {
    const catalogOrgIds = await fetchScopedCatalogOrgIds(session);
    for (const id of catalogOrgIds) {
      if (id) orgIds.add(String(id));
    }
  } catch {
    // catalog optional — keep device-backed count
  }

  return {
    orgCount: orgIds.size,
    branchCount: branchIds.size,
    zoneCount: zoneKeys.size,
    regionCount: regionKeys.size,
    deviceCount: body.hits?.total?.value ?? hits.length,
    deviceStatus,
    lte1,
    lte2,
    lan,
    orgWiseDevices: mapToList(orgs, 'organization'),
    branchWiseDevices: mapToList(branches, 'branch'),
    zoneWiseDevices: mapToList(zones, 'zone'),
    regionWiseDevices: mapToList(regions, 'region'),
  };
}

/**
 * Map pins + status tallies.
 * Status counts use the same getDeviceStatus rules as Device Status widget
 * (all devices in session — not only geocoded pins).
 * Missing device lat/long fall back to branch-index coordinates so assigned
 * devices without GPS still plot (and legend matches Device Status).
 */
export async function getDeviceLocations(session = {}, actTime) {
  const cutoff = actTime ?? getActivityCutoff(ACTIVITY_WINDOW_SECONDS);
  const filters = buildSessionFilters(session);
  const query = filters.length ? { bool: { filter: filters } } : { match_all: {} };

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 10000,
      track_total_hits: true,
      query,
      // No sort — same result set as getDashboardStats / device status
      _source: MAP_SOURCE_FIELDS,
    },
  });

  const hits = body.hits?.hits || [];

  // Tally status immediately from the same classifiers as Device Status
  const statusCounts = { up: 0, down: 0, onboard: 0 };
  for (const h of hits) {
    const status = getDeviceStatus(h._source || {}, cutoff);
    if (status === DEVICE_STATUS.UP) statusCounts.up += 1;
    else if (status === DEVICE_STATUS.DOWN) statusCounts.down += 1;
    else if (status === DEVICE_STATUS.ONBOARD) statusCounts.onboard += 1;
  }

  const branchIds = hits
    .map((h) => h._source?.branchId)
    .filter((id) => id != null && String(id).trim() !== '')
    .map(String);

  const branchCoords = await fetchBranchCoordsByIds(branchIds);
  const devices = [];

  for (const h of hits) {
    const src = h._source || {};
    const status = getDeviceStatus(src, cutoff);

    let lat = Number(src.lat);
    let lng = Number(src.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const bid = src.branchId != null ? String(src.branchId).trim() : '';
      const fromBranch = bid ? branchCoords.get(bid) : null;
      if (fromBranch) {
        lat = fromBranch.lat;
        lng = fromBranch.lng;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    devices.push({
      id: h._id,
      hostname: src.sysname || 'Unknown',
      organization: src.org || 'N/A',
      zone: src.zone || 'N/A',
      region: src.region || 'N/A',
      branch: src.branch || 'N/A',
      model: src.model || 'N/A',
      lat,
      lng,
      status: status || DEVICE_STATUS.DOWN,
      cpuUsage: getCpuPercent(src),
      memUsage: getMemoryUsagePercent(src),
      lastSeen: src.slu || src.lastupdated || 0,
    });
  }

  return {
    devices,
    upCount: statusCounts.up,
    downCount: statusCounts.down,
    onboardCount: statusCounts.onboard,
    total: statusCounts.up + statusCounts.down + statusCounts.onboard,
  };
}

async function fetchBranchCoordsByIds(branchIds) {
  const ids = [...new Set((branchIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: Math.min(ids.length, 10000),
        query: { ids: { values: ids } },
        _source: ['lat', 'long'],
      },
    });
    for (const hit of body.hits?.hits || []) {
      const lat = Number(hit._source?.lat);
      const lng = Number(hit._source?.long);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.set(String(hit._id), { lat, lng });
      }
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}
/**
 * Downtime-duration buckets for assigned devices.
 * Matches manager chart: Up + exclusive Down(10 Min) … Down(> 1 Month).
 * Each device appears in exactly one bucket; includes device list for drill-down.
 */
export async function getUptimeWindows(session = {}) {
  const filters = buildSessionFilters(session);
  const query = filters.length ? { bool: { filter: filters } } : { match_all: {} };
  const now = Math.floor(Date.now() / 1000);
  const activityCutoff = getActivityCutoff(ACTIVITY_WINDOW_SECONDS);

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 10000,
      query,
      _source: UPTIME_SOURCE_FIELDS,
    },
  });

  const buckets = DOWNTIME_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: 0,
    devices: [],
  }));
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  const assigned = (body.hits?.hits || [])
    .map((h) => h._source || {})
    .filter(isAssigned);

  for (const d of assigned) {
    const lastSeen = lastSeenEpoch(d);
    const online = isOnline(d, activityCutoff);
    const age = lastSeen > 0 ? now - lastSeen : Number.POSITIVE_INFINITY;
    const key = downtimeBucketKey(age, online);
    const bucket = byKey[key] || byKey.down_gt_1M;
    bucket.count += 1;
    bucket.devices.push({
      hostname: d.sysname || '—',
      organization: d.org || '',
      zone: d.zone || '',
      region: d.region || '',
      lastSeen,
      downForSeconds: online ? 0 : Math.max(0, age === Number.POSITIVE_INFINITY ? 0 : age),
    });
  }

  return {
    buckets,
    total: assigned.length,
  };
}