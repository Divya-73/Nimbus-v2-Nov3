import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  DEVICE_STATUS,
  buildSessionFilters,
  getActivityCutoff,
  getDeviceStatus,
  getSdwanStatus,
  getUptime,
  isAssigned,
} from '../config/deviceStatusConfig.js';

/** Lean fields for region list / detail — status from deviceStatusConfig in JS. */
const REGION_SOURCE = {
  includes: [
    'sysname',
    'model',
    'orgId',
    'org',
    'branchId',
    'branch',
    'zone',
    'region',
    'slu',
    'lastupdated',
    'uptime',
    'cpu.btime',
    'outlet_name',
  ],
};

const MAX_SCAN = 10000;

function hasFilterValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function escapeWildcard(value) {
  return String(value).replace(/[\\*?]/g, '\\$&');
}

/** Same assignment gate as device list / dashboard. */
function assignedMustClause() {
  return {
    bool: {
      must: [{ exists: { field: 'orgId' } }, { exists: { field: 'branchId' } }],
      must_not: [{ term: { 'orgId.keyword': '' } }, { term: { 'branchId.keyword': '' } }],
    },
  };
}

function buildStructuralMust(filters = {}, session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];

  if (hasFilterValue(filters.orgId)) {
    must.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }
  if (hasFilterValue(filters.zone)) {
    must.push({ term: { 'zone.keyword': String(filters.zone).trim() } });
  }
  if (hasFilterValue(filters.region)) {
    must.push({ term: { 'region.keyword': String(filters.region).trim() } });
  }
  if (hasFilterValue(filters.search)) {
    must.push({
      wildcard: {
        'region.keyword': `*${escapeWildcard(String(filters.search).trim())}*`,
      },
    });
  }

  return must;
}

/**
 * Region rollup from assigned-device status counts (up / down only —
 * onboard docs are excluded by assignedMustClause).
 */
function calculateRegionStatus({ total = 0, up = 0, down = 0 } = {}) {
  if (total === 0) return { status: 'unknown', color: 'gray' };
  if (down === 0) return { status: 'up', color: 'green' };
  if (up === 0) return { status: 'down', color: 'red' };
  return { status: 'partial', color: 'orange' };
}

function emptyRegionRow(regionKey) {
  return {
    id: regionKey,
    region: regionKey,
    up: 0,
    down: 0,
    total: 0,
    zones: new Set(),
    orgs: new Map(), // orgId → name
  };
}

function mapDeviceRow(hit, cutoff) {
  const src = hit._source || {};
  const status = getDeviceStatus(src, cutoff);

  return {
    id: hit._id,
    hostname: src.sysname || 'Unknown',
    sysname: src.sysname || 'Unknown',
    model: src.model || 'N/A',
    branch: src.branch || 'N/A',
    outletName: src.outlet_name || 'N/A',
    zone: src.zone || 'N/A',
    region: src.region || 'N/A',
    orgId: src.orgId || '',
    orgName: src.org || 'N/A',
    status,
    sdwanStatus: getSdwanStatus(src, cutoff),
    uptime: getUptime(src, cutoff),
  };
}

function finalizeRegionRow(row) {
  const deviceCount = {
    total: row.total,
    up: row.up,
    down: row.down,
    upPercentage: row.total > 0 ? Math.round((row.up / row.total) * 100) : 0,
  };
  const rollup = calculateRegionStatus(deviceCount);
  const orgNames = [...row.orgs.values()].sort((a, b) => a.localeCompare(b));
  const zones = [...row.zones].sort((a, b) => a.localeCompare(b));

  return {
    id: row.id,
    region: row.region,
    deviceCount,
    status: rollup.status,
    statusColor: rollup.color,
    zones,
    zoneCount: zones.length,
    orgNames,
    orgCount: orgNames.length,
  };
}

/**
 * Region list — lean fetch + JS status from deviceStatusConfig (same window as device list).
 */
export async function getRegionList(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  const must = buildStructuralMust(filters, session);
  // Drop empty / missing region labels
  must.push({ exists: { field: 'region' } });
  must.push({
    bool: { must_not: [{ term: { 'region.keyword': '' } }] },
  });

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      _source: REGION_SOURCE,
    },
  });

  const byRegion = new Map();

  for (const hit of body.hits?.hits || []) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;

    const regionKey = src.region != null ? String(src.region).trim() : '';
    if (!regionKey) continue;

    let row = byRegion.get(regionKey);
    if (!row) {
      row = emptyRegionRow(regionKey);
      byRegion.set(regionKey, row);
    }

    const status = getDeviceStatus(src, cutoff);
    row.total += 1;
    if (status === DEVICE_STATUS.UP) row.up += 1;
    else if (status === DEVICE_STATUS.DOWN) row.down += 1;

    if (src.zone) row.zones.add(String(src.zone).trim());
    if (src.orgId) {
      const name = src.org != null && String(src.org).trim() ? String(src.org).trim() : String(src.orgId);
      row.orgs.set(String(src.orgId), name);
    }
  }

  const data = [...byRegion.values()]
    .map(finalizeRegionRow)
    .sort((a, b) => a.region.localeCompare(b.region));

  return {
    total: data.length,
    data,
    appliedFilters: filters,
  };
}

/**
 * Single region + its devices (same status classifiers as device list).
 */
export async function getRegionByName(regionName, filters = {}, session = {}) {
  const name = String(regionName || '').trim();
  if (!name) {
    return {
      data: {
        region: '',
        deviceCount: { total: 0, up: 0, down: 0, upPercentage: 0 },
        regionStatus: 'unknown',
        regionStatusColor: 'gray',
        devices: [],
        appliedFilters: filters,
      },
    };
  }

  const cutoff = getActivityCutoff();
  const must = buildStructuralMust({ ...filters, search: undefined }, session);
  must.push({ term: { 'region.keyword': name } });

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      sort: [
        { slu: { order: 'desc' } },
        { 'sysname.keyword': { order: 'asc' } },
      ],
      _source: REGION_SOURCE,
    },
  });

  const hits = (body.hits?.hits || []).filter((h) => isAssigned(h._source || {}));
  let up = 0;
  let down = 0;

  const devices = hits.map((hit) => {
    const status = getDeviceStatus(hit._source || {}, cutoff);
    if (status === DEVICE_STATUS.UP) up += 1;
    else if (status === DEVICE_STATUS.DOWN) down += 1;
    return mapDeviceRow(hit, cutoff);
  });

  const deviceCount = {
    total: devices.length,
    up,
    down,
    upPercentage: devices.length > 0 ? Math.round((up / devices.length) * 100) : 0,
  };
  const rollup = calculateRegionStatus(deviceCount);

  return {
    data: {
      region: name,
      deviceCount,
      regionStatus: rollup.status,
      regionStatusColor: rollup.color,
      devices,
      appliedFilters: filters,
    },
  };
}

/**
 * Filter dropdown options for region list (scoped by session).
 */
export async function getRegionFilterOptions(session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];
  must.push({ exists: { field: 'region' } });
  must.push({
    bool: { must_not: [{ term: { 'region.keyword': '' } }] },
  });

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 0,
      query: { bool: { must } },
      aggs: {
        organizations: {
          composite: {
            size: 1000,
            sources: [
              { orgId: { terms: { field: 'orgId.keyword' } } },
              { orgName: { terms: { field: 'org.keyword' } } },
            ],
          },
        },
        zones: {
          terms: { field: 'zone.keyword', size: 100, order: { _key: 'asc' } },
        },
      },
    },
  });

  const aggs = body.aggregations || {};
  const organizationsMap = new Map();

  for (const bucket of aggs.organizations?.buckets || []) {
    const orgId = bucket.key?.orgId;
    const orgName = bucket.key?.orgName;
    if (orgId && orgName) organizationsMap.set(String(orgId), String(orgName));
  }

  return {
    organizations: [...organizationsMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    zones: (aggs.zones?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
  };
}
