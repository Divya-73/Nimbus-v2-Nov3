import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  DEVICE_STATUS,
  buildSessionFilters,
  getActivityCutoff,
  getDeviceStatus,
  getSdwanStatus,
  getUptime,
} from '../config/deviceStatusConfig.js';
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';

const MAX_SCAN = 10000;

/** Lean fields for branch-index rows. */
const BRANCH_SOURCE = {
  includes: [
    'branch',
    'branch_type',
    'site_id',
    'zone',
    'region',
    'orgId',
    'outlet_name',
    'outlet_code',
    'ro_code',
    'sales_area',
    'automation_vendor',
    'phase',
    'address',
    'lat',
    'long',
    'phone',
    'email',
    'web',
    'tags',
    'datecreated',
    'lastupdated',
  ],
};

/** Lean device fields for status rollup (same classifiers as device / zone list). */
const DEVICE_STATUS_SOURCE = {
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

function hasFilterValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function escapeWildcard(value) {
  return String(value).replace(/[\\*?]/g, '\\$&');
}

function toUnix(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Session scope for the branch index.
 * branch-scoped users are limited to docs where _id === session.branchId.
 */
function buildBranchSessionFilters(session = {}) {
  const filters = [];
  const { orgId, branchId, zone, region, tags } = session;

  if (hasFilterValue(orgId)) {
    filters.push({ term: { 'orgId.keyword': String(orgId).trim() } });
  }
  if (hasFilterValue(branchId)) {
    filters.push({ term: { _id: String(branchId).trim() } });
  }
  if (hasFilterValue(zone)) {
    filters.push({ term: { 'zone.keyword': String(zone).trim() } });
  }
  if (hasFilterValue(region)) {
    filters.push({ term: { 'region.keyword': String(region).trim() } });
  }
  if (hasFilterValue(tags)) {
    filters.push({
      wildcard: { 'tags.keyword': `*${escapeWildcard(String(tags).trim())}*` },
    });
  }

  return filters;
}

function buildBranchMust(filters = {}, session = {}) {
  const must = [...buildBranchSessionFilters(session)];

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
    const q = escapeWildcard(String(filters.search).trim());
    must.push({
      bool: {
        should: [
          { wildcard: { 'branch.keyword': `*${q}*` } },
          { wildcard: { 'site_id.keyword': `*${q}*` } },
          { wildcard: { 'outlet_name.keyword': `*${q}*` } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // Branches should belong to an org
  must.push({ exists: { field: 'orgId' } });
  must.push({
    bool: { must_not: [{ term: { 'orgId.keyword': '' } }] },
  });

  return must;
}

/**
 * Branch rollup from assigned-device status counts (up / down only —
 * same semantics as zone / region list).
 */
function calculateBranchStatus({ total = 0, up = 0, down = 0 } = {}) {
  if (total === 0) return { status: 'unknown', color: 'gray' };
  if (down === 0) return { status: 'up', color: 'green' };
  if (up === 0) return { status: 'down', color: 'red' };
  return { status: 'partial', color: 'orange' };
}

function emptyDeviceCount() {
  return { total: 0, up: 0, down: 0 };
}

function mapDeviceRow(hit, cutoff, resolvedBranchName) {
  const src = hit._source || {};
  const status = getDeviceStatus(src, cutoff);

  return {
    id: hit._id,
    hostname: src.sysname || 'Unknown',
    sysname: src.sysname || 'Unknown',
    model: src.model || 'N/A',
    branch: resolvedBranchName || src.branch || 'N/A',
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

async function fetchOrgNames(orgIds) {
  const unique = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = {};
  if (!unique.length) return map;

  const { body } = await client.search({
    index: INDICES.ORGANIZATIONS,
    body: {
      size: Math.min(unique.length, MAX_SCAN),
      query: { ids: { values: unique } },
      _source: ['org_name', 'org'],
    },
  });

  for (const doc of body.hits?.hits || []) {
    const src = doc._source || {};
    map[doc._id] = src.org_name || src.org || 'N/A';
  }
  return map;
}

/**
 * Device tallies keyed by branch display name — same rule as dashboard
 * (device.branch, or branch-index name via branchId when blank).
 */
async function deviceCountsByBranchNames(branchNames, cutoff, session = {}) {
  const names = new Set(
    (branchNames || [])
      .map((n) => (n != null ? String(n).trim() : ''))
      .filter(Boolean),
  );
  const counts = new Map();
  for (const name of names) counts.set(name, emptyDeviceCount());
  if (!names.size) return counts;

  const must = [...buildSessionFilters(session)];
  const query = must.length ? { bool: { filter: must } } : { match_all: {} };

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query,
      _source: DEVICE_STATUS_SOURCE,
    },
  });

  const hits = body.hits?.hits || [];
  const branchNamesById = await fetchBranchNamesByIds(
    hits.map((h) => h._source?.branchId).filter(Boolean),
  );

  for (const hit of hits) {
    const src = hit._source || {};
    const name = resolveBranchName(src, branchNamesById);
    if (!name || !names.has(name)) continue;

    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    const row = counts.get(name) || emptyDeviceCount();
    row.total += 1;
    if (status === DEVICE_STATUS.UP) row.up += 1;
    else row.down += 1;
    counts.set(name, row);
  }

  return counts;
}

/**
 * Branch list — branch index rows + device tallies from deviceStatusConfig.
 * Client paginates; returns full filtered set.
 */
export async function getBranchList(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  const must = buildBranchMust(filters, session);
  const query = must.length ? { bool: { must } } : { match_all: {} };

  let branchBody;
  try {
    ({ body: branchBody } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        query,
        size: MAX_SCAN,
        track_total_hits: true,
        sort: [{ _id: { order: 'desc' } }],
        _source: BRANCH_SOURCE,
      },
    }));
  } catch (err) {
    const type = err?.meta?.body?.error?.type;
    if (type === 'index_not_found_exception') {
      return { total: 0, data: [], appliedFilters: filters };
    }
    throw err;
  }

  const hits = (branchBody.hits?.hits || []).filter((h) => hasFilterValue(h._source?.orgId));
  const branchNames = hits.map((h) => h._source?.branch).filter(Boolean);
  const orgIds = hits.map((h) => h._source?.orgId).filter(Boolean);

  const [deviceCounts, orgMap] = await Promise.all([
    deviceCountsByBranchNames(branchNames, cutoff, session),
    fetchOrgNames(orgIds),
  ]);

  const data = hits.map((hit) => {
    const b = hit._source || {};
    const branchName = b.branch != null ? String(b.branch).trim() : '';
    const dc = deviceCounts.get(branchName) || emptyDeviceCount();
    const rollup = calculateBranchStatus(dc);

    return {
      id: hit._id,
      branch: b.branch || 'N/A',
      branchType: b.branch_type || 'N/A',
      siteId: b.site_id || 'N/A',
      zone: b.zone || 'N/A',
      region: b.region || 'N/A',
      orgId: b.orgId || '',
      orgName: orgMap[b.orgId] || 'N/A',
      outletName: b.outlet_name || 'N/A',
      outletCode: b.outlet_code || 'N/A',
      roCode: b.ro_code || 'N/A',
      branchStatus: rollup.status,
      branchStatusColor: rollup.color,
      deviceCount: {
        total: dc.total,
        up: dc.up,
        down: dc.down,
        upPercentage: dc.total > 0 ? Math.round((dc.up / dc.total) * 100) : 0,
      },
      dateCreated: toUnix(b.datecreated),
      lastUpdated: toUnix(b.lastupdated),
      tags: b.tags || '',
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      web: b.web || '',
      lat: b.lat || '',
      long: b.long || '',
    };
  });

  return {
    total: data.length,
    data,
    appliedFilters: filters,
  };
}

/**
 * Single branch by id + its assigned devices (same status classifiers as device list).
 */
export async function getBranchById(branchId, session = {}) {
  const id = String(branchId || '').trim();
  if (!id) {
    const err = new Error('Branch id is required');
    err.status = 400;
    throw err;
  }

  if (hasFilterValue(session.branchId) && String(session.branchId) !== id) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  let branchDoc;
  try {
    ({ body: branchDoc } = await client.get({
      index: INDICES.BRANCHES,
      id,
    }));
  } catch (err) {
    if (err?.meta?.statusCode === 404) {
      const notFound = new Error('Branch not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }

  const b = branchDoc._source || {};

  if (hasFilterValue(session.orgId) && String(b.orgId || '') !== String(session.orgId).trim()) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  let orgName = 'N/A';
  let logo = '';
  if (hasFilterValue(b.orgId)) {
    const orgs = await fetchOrgNames([b.orgId]);
    orgName = orgs[b.orgId] || 'N/A';
    try {
      const { body: orgDoc } = await client.get({
        index: INDICES.ORGANIZATIONS,
        id: String(b.orgId),
      });
      logo = orgDoc._source?.logo || '';
      orgName = orgDoc._source?.org_name || orgDoc._source?.org || orgName;
    } catch {
      /* org name already from map / default */
    }
  }

  const cutoff = getActivityCutoff();
  const branchName = b.branch != null ? String(b.branch).trim() : '';
  const must = [...buildSessionFilters(session)];
  // Include devices labeled with this name OR linked by branchId (blank name fill)
  if (branchName) {
    must.push({
      bool: {
        should: [
          { term: { 'branch.keyword': branchName } },
          { term: { 'branchId.keyword': id } },
        ],
        minimum_should_match: 1,
      },
    });
  } else {
    must.push({ term: { 'branchId.keyword': id } });
  }

  const { body: devicesBody } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      sort: [
        { slu: { order: 'desc' } },
        { 'sysname.keyword': { order: 'asc' } },
      ],
      _source: DEVICE_STATUS_SOURCE,
    },
  });

  const rawHits = devicesBody.hits?.hits || [];
  const branchNamesById = await fetchBranchNamesByIds(
    rawHits.map((h) => h._source?.branchId).filter(Boolean),
  );
  // Ensure this branch's own name is available for id → name fill
  if (branchName) branchNamesById.set(id, branchName);

  let up = 0;
  let down = 0;
  const devices = [];

  for (const hit of rawHits) {
    const src = hit._source || {};
    const resolved = resolveBranchName(src, branchNamesById);
    if (branchName) {
      if (resolved !== branchName) continue;
    } else if (!resolved) {
      continue;
    }

    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    if (status === DEVICE_STATUS.UP) up += 1;
    else down += 1;
    devices.push(mapDeviceRow(hit, cutoff, resolved));
  }

  const deviceCount = {
    total: devices.length,
    up,
    down,
    upPercentage: devices.length > 0 ? Math.round((up / devices.length) * 100) : 0,
  };
  const rollup = calculateBranchStatus(deviceCount);

  return {
    data: {
      id,
      branch: b.branch || '',
      branchType: b.branch_type || '',
      siteId: b.site_id || '',
      zone: b.zone || '',
      region: b.region || '',
      orgId: b.orgId || '',
      outletCode: b.outlet_code || '',
      roCode: b.ro_code || '',
      salesArea: b.sales_area || '',
      outletName: b.outlet_name || '',
      automationVendor: b.automation_vendor || '',
      phase: b.phase || '',
      address: b.address || '',
      lat: b.lat || '',
      long: b.long || '',
      phone: b.phone || '',
      email: b.email || '',
      web: b.web || '',
      tags: b.tags || '',
      orgName,
      logo,
      branchStatus: rollup.status,
      branchStatusColor: rollup.color,
      deviceCount,
      devices,
      dateCreated: toUnix(b.datecreated),
      lastUpdated: toUnix(b.lastupdated),
    },
  };
}

/**
 * Filter dropdown options for branch list (scoped by session).
 * Optional filters.orgId further narrows options (e.g. branch management UI).
 */
export async function getBranchFilterOptions(session = {}, filters = {}) {
  const must = [...buildBranchSessionFilters(session)];
  if (hasFilterValue(filters.orgId)) {
    must.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }
  must.push({ exists: { field: 'orgId' } });
  must.push({
    bool: { must_not: [{ term: { 'orgId.keyword': '' } }] },
  });

  let body;
  try {
    ({ body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: 0,
        query: must.length ? { bool: { must } } : { match_all: {} },
        aggs: {
          organizations: {
            terms: { field: 'orgId.keyword', size: 1000 },
          },
          zones: {
            terms: { field: 'zone.keyword', size: 200, order: { _key: 'asc' } },
          },
          regions: {
            terms: { field: 'region.keyword', size: 200, order: { _key: 'asc' } },
          },
        },
      },
    }));
  } catch (err) {
    if (err?.meta?.body?.error?.type === 'index_not_found_exception') {
      return { organizations: [], zones: [], regions: [] };
    }
    throw err;
  }

  const aggs = body.aggregations || {};
  const orgIds = (aggs.organizations?.buckets || []).map((b) => b.key).filter(Boolean);
  const orgMap = await fetchOrgNames(orgIds);

  return {
    organizations: orgIds
      .map((id) => ({ id: String(id), name: orgMap[id] || String(id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    zones: (aggs.zones?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
    regions: (aggs.regions?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
  };
}
