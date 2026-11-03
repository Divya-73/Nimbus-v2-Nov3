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

/** Lean fields for zone list / detail — status from deviceStatusConfig in JS. */
const ZONE_SOURCE = {
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

/** Same assignment gate as device list / region list / dashboard. */
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
  if (hasFilterValue(filters.region)) {
    must.push({ term: { 'region.keyword': String(filters.region).trim() } });
  }
  if (hasFilterValue(filters.zone)) {
    must.push({ term: { 'zone.keyword': String(filters.zone).trim() } });
  }
  if (hasFilterValue(filters.search)) {
    must.push({
      wildcard: {
        'zone.keyword': `*${escapeWildcard(String(filters.search).trim())}*`,
      },
    });
  }

  return must;
}

/**
 * Zone rollup from assigned-device status counts (up / down only —
 * onboard docs are excluded by assignedMustClause).
 */
function calculateZoneStatus({ total = 0, up = 0, down = 0 } = {}) {
  if (total === 0) return { status: 'unknown', color: 'gray' };
  if (down === 0) return { status: 'up', color: 'green' };
  if (up === 0) return { status: 'down', color: 'red' };
  return { status: 'partial', color: 'orange' };
}

function emptyZoneRow(zoneKey) {
  return {
    id: zoneKey,
    zone: zoneKey,
    up: 0,
    down: 0,
    total: 0,
    regions: new Set(),
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

function finalizeZoneRow(row) {
  const deviceCount = {
    total: row.total,
    up: row.up,
    down: row.down,
    upPercentage: row.total > 0 ? Math.round((row.up / row.total) * 100) : 0,
  };
  const rollup = calculateZoneStatus(deviceCount);
  const orgNames = [...row.orgs.values()].sort((a, b) => a.localeCompare(b));
  const regions = [...row.regions].sort((a, b) => a.localeCompare(b));

  return {
    id: row.id,
    zone: row.zone,
    deviceCount,
    status: rollup.status,
    statusColor: rollup.color,
    regions,
    regionCount: regions.length,
    orgNames,
    orgCount: orgNames.length,
  };
}

/**
 * Zone list — lean fetch + JS status from deviceStatusConfig (same window as device list).
 */
export async function getZoneList(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  const must = buildStructuralMust(filters, session);
  must.push({ exists: { field: 'zone' } });
  must.push({
    bool: { must_not: [{ term: { 'zone.keyword': '' } }] },
  });

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      _source: ZONE_SOURCE,
    },
  });

  const byZone = new Map();

  for (const hit of body.hits?.hits || []) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;

    const zoneKey = src.zone != null ? String(src.zone).trim() : '';
    if (!zoneKey) continue;

    let row = byZone.get(zoneKey);
    if (!row) {
      row = emptyZoneRow(zoneKey);
      byZone.set(zoneKey, row);
    }

    const status = getDeviceStatus(src, cutoff);
    row.total += 1;
    if (status === DEVICE_STATUS.UP) row.up += 1;
    else if (status === DEVICE_STATUS.DOWN) row.down += 1;

    if (src.region) row.regions.add(String(src.region).trim());
    if (src.orgId) {
      const name =
        src.org != null && String(src.org).trim() ? String(src.org).trim() : String(src.orgId);
      row.orgs.set(String(src.orgId), name);
    }
  }

  const data = [...byZone.values()]
    .map(finalizeZoneRow)
    .sort((a, b) => a.zone.localeCompare(b.zone));

  return {
    total: data.length,
    data,
    appliedFilters: filters,
  };
}

/**
 * Single zone + its devices (same status classifiers as device list).
 */
export async function getZoneByName(zoneName, filters = {}, session = {}) {
  const name = String(zoneName || '').trim();
  if (!name) {
    return {
      data: {
        zone: '',
        deviceCount: { total: 0, up: 0, down: 0, upPercentage: 0 },
        zoneStatus: 'unknown',
        zoneStatusColor: 'gray',
        devices: [],
        appliedFilters: filters,
      },
    };
  }

  const cutoff = getActivityCutoff();
  const must = buildStructuralMust({ ...filters, search: undefined }, session);
  must.push({ term: { 'zone.keyword': name } });

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
      _source: ZONE_SOURCE,
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
  const rollup = calculateZoneStatus(deviceCount);

  return {
    data: {
      zone: name,
      deviceCount,
      zoneStatus: rollup.status,
      zoneStatusColor: rollup.color,
      devices,
      appliedFilters: filters,
    },
  };
}

/**
 * Filter dropdown options for zone list (scoped by session).
 */
export async function getZoneFilterOptions(session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];
  must.push({ exists: { field: 'zone' } });
  must.push({
    bool: { must_not: [{ term: { 'zone.keyword': '' } }] },
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
        regions: {
          terms: { field: 'region.keyword', size: 200, order: { _key: 'asc' } },
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
    regions: (aggs.regions?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
  };
}
