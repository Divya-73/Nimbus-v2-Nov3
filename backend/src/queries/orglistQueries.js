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
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';
import { fetchOrgNamesByIds, resolveOrgName } from './orgNameLookup.js';

const MAX_SCAN = 10000;

/** Lean device fields for org rollups / detail rows. */
const ORG_DEVICE_SOURCE = {
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

/** Same assignment gate as device / zone / region / branch / model lists. */
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
  // Branch filter applied in JS via resolveBranchName (blank device.branch still matches)
  if (hasFilterValue(filters.search)) {
    const q = escapeWildcard(String(filters.search).trim());
    must.push({
      bool: {
        should: [
          { wildcard: { 'org.keyword': `*${q}*` } },
          { wildcard: { 'sysname.keyword': `*${q}*` } },
          { wildcard: { 'branch.keyword': `*${q}*` } },
          { wildcard: { 'zone.keyword': `*${q}*` } },
          { wildcard: { 'region.keyword': `*${q}*` } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  return must;
}

function calculateOrgStatus({ total = 0, up = 0, down = 0 } = {}) {
  if (total === 0) return { status: 'unknown', color: 'gray' };
  if (down === 0) return { status: 'up', color: 'green' };
  if (up === 0) return { status: 'down', color: 'red' };
  return { status: 'partial', color: 'orange' };
}

function emptyOrgRow(orgId, orgName = '') {
  return {
    id: orgId,
    orgId,
    orgName: orgName || orgId,
    up: 0,
    down: 0,
    total: 0,
    zones: new Set(),
    regions: new Set(),
    branches: new Set(),
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

function emptyCatalog() {
  return {
    orgName: 'N/A',
    logo: null,
    datecreated: null,
    lastupdated: null,
  };
}

function mapOrgCatalog(src = {}) {
  return {
    orgName: src.org_name || src.org || 'N/A',
    logo: src.logo || null,
    datecreated: src.datecreated || null,
    lastupdated: src.lastupdated || null,
  };
}

async function fetchOrgCatalogByIds(orgIds) {
  const ids = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = {};
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: Math.min(ids.length, MAX_SCAN),
        query: { ids: { values: ids } },
        _source: ['org_name', 'org', 'logo', 'datecreated', 'lastupdated'],
      },
    });
    for (const hit of body.hits?.hits || []) {
      map[hit._id] = mapOrgCatalog(hit._source || {});
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

/**
 * Full org-catalog docs for list merge (includes orgs with zero devices).
 * Filter orgId / session.orgId scopes the set; otherwise all catalog orgs.
 */
async function fetchOrgCatalogForList(session = {}, filters = {}) {
  const must = [];

  if (hasFilterValue(filters.orgId)) {
    must.push({ ids: { values: [String(filters.orgId).trim()] } });
  } else if (hasFilterValue(session.orgId)) {
    must.push({ ids: { values: [String(session.orgId).trim()] } });
  }

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: MAX_SCAN,
        track_total_hits: true,
        query: must.length ? { bool: { must } } : { match_all: {} },
        _source: ['org_name', 'org', 'logo', 'datecreated', 'lastupdated'],
      },
    });

    return (body.hits?.hits || []).map((hit) => {
      const meta = mapOrgCatalog(hit._source || {});
      return {
        id: String(hit._id),
        orgName: meta.orgName,
        logo: meta.logo,
        datecreated: meta.datecreated,
        lastupdated: meta.lastupdated,
      };
    });
  } catch (err) {
    if (err?.meta?.body?.error?.type === 'index_not_found_exception') return [];
    throw err;
  }
}

/** Catalog org ids (session-scoped) — shared with dashboard orgCount. */
export async function fetchScopedCatalogOrgIds(session = {}, filters = {}) {
  const docs = await fetchOrgCatalogForList(session, filters);
  return docs.map((d) => d.id).filter(Boolean);
}

/** Count branch docs per org from the branch index. */
async function fetchBranchCountsByOrgIds(orgIds) {
  const ids = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: 0,
        query: { terms: { 'orgId.keyword': ids } },
        aggs: {
          by_org: { terms: { field: 'orgId.keyword', size: ids.length } },
        },
      },
    });
    for (const bucket of body.aggregations?.by_org?.buckets || []) {
      map[String(bucket.key)] = bucket.doc_count || 0;
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

/** Count network docs per org from branchnet. */
async function fetchNetworkCountsByOrgIds(orgIds) {
  const ids = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.NETWORKS,
      body: {
        size: 0,
        query: { terms: { 'orgId.keyword': ids } },
        aggs: {
          by_org: { terms: { field: 'orgId.keyword', size: ids.length } },
        },
      },
    });
    for (const bucket of body.aggregations?.by_org?.buckets || []) {
      map[String(bucket.key)] = bucket.doc_count || 0;
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

function finalizeOrgRow(row, catalog = {}, branchCounts = {}, networkCounts = {}) {
  const deviceCount = {
    total: row.total,
    up: row.up,
    down: row.down,
    upPercentage: row.total > 0 ? Math.round((row.up / row.total) * 100) : 0,
  };
  const rollup = calculateOrgStatus(deviceCount);
  const meta = catalog[row.orgId] || emptyCatalog();
  const zones = [...row.zones].sort((a, b) => a.localeCompare(b));
  const regions = [...row.regions].sort((a, b) => a.localeCompare(b));
  const branches = [...row.branches].sort((a, b) => a.localeCompare(b));
  const orgName =
    meta.orgName && meta.orgName !== 'N/A'
      ? meta.orgName
      : row.orgName && row.orgName !== row.orgId
        ? row.orgName
        : meta.orgName || row.orgName || row.orgId;

  return {
    id: row.orgId,
    orgId: row.orgId,
    orgName,
    logo: meta.logo,
    datecreated: meta.datecreated,
    lastupdated: meta.lastupdated,
    zones,
    zoneCount: zones.length,
    regions,
    regionCount: regions.length,
    branches,
    branchNamesCount: branches.length,
    /** Unique resolved branch names from devices (matches dashboard branch-wise). */
    branchCount: branches.length,
    /** Branch index docs for this org (catalog size; may differ from resolved names). */
    branchIndexCount: branchCounts[row.orgId] ?? 0,
    networkCount: networkCounts[row.orgId] ?? 0,
    deviceCount,
    status: rollup.status,
    statusColor: rollup.color,
    orgStatus: rollup.status,
    orgStatusColor: rollup.color,
  };
}

/**
 * Org list — device rollups + org catalog merge so orgs with no devices still appear.
 * Zone / region / branch filters stay device-backed (empty catalog orgs are omitted then).
 */
export async function getOrgList(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  // Apply search in JS after catalog merge (keeps zero-device orgs findable by name)
  const deviceFilters = { ...filters };
  delete deviceFilters.search;
  const must = buildStructuralMust(deviceFilters, session);

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      _source: ORG_DEVICE_SOURCE,
    },
  });

  const hits = body.hits?.hits || [];
  const branchNamesById = await fetchBranchNamesByIds(
    hits.map((h) => h._source?.branchId).filter(Boolean)
  );
  const branchFilter = hasFilterValue(filters.branch)
    ? String(filters.branch).trim()
    : '';

  const byOrg = new Map();

  for (const hit of hits) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;

    const orgId = src.orgId != null ? String(src.orgId).trim() : '';
    if (!orgId) continue;

    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    const branchName = resolveBranchName(src, branchNamesById);
    if (branchFilter && branchName !== branchFilter) continue;

    let row = byOrg.get(orgId);
    if (!row) {
      const name =
        src.org != null && String(src.org).trim() ? String(src.org).trim() : orgId;
      row = emptyOrgRow(orgId, name);
      byOrg.set(orgId, row);
    }

    row.total += 1;
    if (status === DEVICE_STATUS.UP) row.up += 1;
    else row.down += 1;

    if (src.zone) row.zones.add(String(src.zone).trim());
    if (src.region) row.regions.add(String(src.region).trim());
    if (branchName) row.branches.add(branchName);
  }

  // Include catalog organizations that have no (up/down) devices yet
  const deviceScopedFilter =
    hasFilterValue(filters.zone) ||
    hasFilterValue(filters.region) ||
    hasFilterValue(filters.branch);

  if (!deviceScopedFilter) {
    const catalogOrgs = await fetchOrgCatalogForList(session, filters);
    for (const org of catalogOrgs) {
      if (!org?.id || byOrg.has(org.id)) continue;
      byOrg.set(org.id, emptyOrgRow(org.id, org.orgName));
    }
  }

  const orgIds = [...byOrg.keys()];
  const [catalog, branchCounts, networkCounts] = await Promise.all([
    fetchOrgCatalogByIds(orgIds),
    fetchBranchCountsByOrgIds(orgIds),
    fetchNetworkCountsByOrgIds(orgIds),
  ]);

  let data = [...byOrg.values()]
    .map((row) => finalizeOrgRow(row, catalog, branchCounts, networkCounts))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));

  // Search may match org catalog name when device.org label is blank
  if (hasFilterValue(filters.search)) {
    const q = String(filters.search).trim().toLowerCase();
    data = data.filter(
      (row) =>
        row.orgName.toLowerCase().includes(q) ||
        row.orgId.toLowerCase().includes(q) ||
        row.zones.some((z) => z.toLowerCase().includes(q)) ||
        row.regions.some((r) => r.toLowerCase().includes(q)) ||
        row.branches.some((b) => b.toLowerCase().includes(q))
    );
  }

  return {
    total: data.length,
    data,
    appliedFilters: filters,
  };
}

/**
 * Single org + its assigned devices (same status classifiers as device list).
 */
export async function getOrgById(orgId, filters = {}, session = {}) {
  const id = String(orgId || '').trim();
  if (!id) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  // Session-scoped users may only read their own org
  if (session?.orgId && String(session.orgId) !== id) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const cutoff = getActivityCutoff();
  const must = buildStructuralMust(
    { ...filters, orgId: id, search: undefined },
    session
  );

  const [catalogMap, branchCounts, networkCounts, deviceSearch] = await Promise.all([
    fetchOrgCatalogByIds([id]),
    fetchBranchCountsByOrgIds([id]),
    fetchNetworkCountsByOrgIds([id]),
    client.search({
      index: INDICES.DEVICES,
      body: {
        size: MAX_SCAN,
        track_total_hits: true,
        query: { bool: { must } },
        sort: [
          { slu: { order: 'desc' } },
          { 'sysname.keyword': { order: 'asc' } },
        ],
        _source: ORG_DEVICE_SOURCE,
      },
    }),
  ]);

  const catalog = catalogMap[id] || emptyCatalog();
  const rawHits = deviceSearch.body.hits?.hits || [];
  const branchNamesById = await fetchBranchNamesByIds(
    rawHits.map((h) => h._source?.branchId).filter(Boolean)
  );
  const branchFilter = hasFilterValue(filters.branch)
    ? String(filters.branch).trim()
    : '';

  let up = 0;
  let down = 0;
  const devices = [];
  const zones = new Set();
  const regions = new Set();
  const branches = new Set();

  for (const hit of rawHits) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;
    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;
    const branchName = resolveBranchName(src, branchNamesById);
    if (branchFilter && branchName !== branchFilter) continue;
    if (status === DEVICE_STATUS.UP) up += 1;
    else down += 1;
    if (src.zone) zones.add(String(src.zone).trim());
    if (src.region) regions.add(String(src.region).trim());
    if (branchName) branches.add(branchName);
    devices.push(mapDeviceRow(hit, cutoff));
  }

  const deviceCount = {
    total: devices.length,
    up,
    down,
    upPercentage: devices.length > 0 ? Math.round((up / devices.length) * 100) : 0,
  };
  const rollup = calculateOrgStatus(deviceCount);
  const zoneList = [...zones].sort((a, b) => a.localeCompare(b));
  const regionList = [...regions].sort((a, b) => a.localeCompare(b));
  const branchList = [...branches].sort((a, b) => a.localeCompare(b));

  return {
    data: {
      id,
      orgId: id,
      orgName: catalog.orgName !== 'N/A' ? catalog.orgName : id,
      logo: catalog.logo,
      datecreated: catalog.datecreated,
      lastupdated: catalog.lastupdated,
      zones: zoneList,
      zoneCount: zoneList.length,
      regions: regionList,
      regionCount: regionList.length,
      branches: branchList,
      branchNamesCount: branchList.length,
      branchCount: branchList.length,
      branchIndexCount: branchCounts[id] ?? 0,
      networkCount: networkCounts[id] ?? 0,
      deviceCount,
      status: rollup.status,
      statusColor: rollup.color,
      orgStatus: rollup.status,
      orgStatusColor: rollup.color,
      devices,
      appliedFilters: filters,
    },
  };
}

/**
 * Filter dropdown options for org list (scoped by session).
 * Counts use the same resolveBranchName / up+down rules as the org list
 * so blank device.branch labels still contribute (matches table totals).
 */
export async function getOrgFilterOptions(session = {}) {
  const cutoff = getActivityCutoff();
  const must = [...buildSessionFilters(session), assignedMustClause()];

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      query: { bool: { must } },
      _source: {
        includes: ['orgId', 'org', 'branchId', 'branch', 'zone', 'region', 'slu', 'lastupdated'],
      },
    },
  });

  const hits = body.hits?.hits || [];
  const [branchNamesById, orgNamesById] = await Promise.all([
    fetchBranchNamesByIds(hits.map((h) => h._source?.branchId).filter(Boolean)),
    fetchOrgNamesByIds(hits.map((h) => h._source?.orgId).filter(Boolean)),
  ]);

  const organizationsMap = new Map(); // id → { name, count }
  const zones = new Map();
  const regions = new Map();
  const branches = new Map();

  for (const hit of hits) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;
    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    const orgId = src.orgId != null ? String(src.orgId).trim() : '';
    if (orgId) {
      const orgName = resolveOrgName(src, orgNamesById) || orgId;
      const prev = organizationsMap.get(orgId) || { name: orgName, count: 0 };
      prev.name = orgName;
      prev.count += 1;
      organizationsMap.set(orgId, prev);
    }

    const branchName = resolveBranchName(src, branchNamesById);
    if (branchName) branches.set(branchName, (branches.get(branchName) || 0) + 1);

    if (src.zone) {
      const z = String(src.zone).trim();
      if (z) zones.set(z, (zones.get(z) || 0) + 1);
    }
    if (src.region) {
      const r = String(src.region).trim();
      if (r) regions.set(r, (regions.get(r) || 0) + 1);
    }
  }

  return {
    organizations: [...organizationsMap.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    zones: [...zones.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regions.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    branches: [...branches.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function emptyCountBag() {
  return { total: 0, up: 0, down: 0 };
}

function bumpCount(row, status) {
  row.total += 1;
  if (status === DEVICE_STATUS.UP) row.up += 1;
  else row.down += 1;
}

function finalizeNodeCounts(counts) {
  const deviceCount = {
    total: counts.total,
    up: counts.up,
    down: counts.down,
    upPercentage: counts.total > 0 ? Math.round((counts.up / counts.total) * 100) : 0,
  };
  const rollup = calculateOrgStatus(deviceCount);
  return {
    deviceCount,
    status: rollup.status,
    statusColor: rollup.color,
  };
}

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/**
 * Full topology tree: Organization → Branch → Zone → Region → Devices.
 * Same status / name-resolution rules as the org list.
 */
export async function getOrgHierarchy(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  const must = buildStructuralMust(filters, session);

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      sort: [{ 'sysname.keyword': { order: 'asc' } }],
      _source: ORG_DEVICE_SOURCE,
    },
  });

  const hits = body.hits?.hits || [];
  const [branchNamesById, orgNamesById] = await Promise.all([
    fetchBranchNamesByIds(hits.map((h) => h._source?.branchId).filter(Boolean)),
    fetchOrgNamesByIds(hits.map((h) => h._source?.orgId).filter(Boolean)),
  ]);

  const branchFilter = hasFilterValue(filters.branch)
    ? String(filters.branch).trim()
    : '';

  // orgId → { meta, counts, branches: Map }
  const byOrg = new Map();

  for (const hit of hits) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;

    const orgId = src.orgId != null ? String(src.orgId).trim() : '';
    if (!orgId) continue;

    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    const branchName = resolveBranchName(src, branchNamesById) || 'Unassigned';
    if (branchFilter && branchName !== branchFilter) continue;

    const orgName = resolveOrgName(src, orgNamesById) || orgId;
    const zoneName =
      src.zone != null && String(src.zone).trim() ? String(src.zone).trim() : 'Unassigned';
    const regionName =
      src.region != null && String(src.region).trim()
        ? String(src.region).trim()
        : 'Unassigned';

    let orgNode = byOrg.get(orgId);
    if (!orgNode) {
      orgNode = {
        orgId,
        name: orgName,
        counts: emptyCountBag(),
        branches: new Map(),
      };
      byOrg.set(orgId, orgNode);
    } else if (orgName && orgNode.name === orgId) {
      orgNode.name = orgName;
    }

    bumpCount(orgNode.counts, status);

    let branchNode = orgNode.branches.get(branchName);
    if (!branchNode) {
      branchNode = {
        name: branchName,
        counts: emptyCountBag(),
        zones: new Map(),
      };
      orgNode.branches.set(branchName, branchNode);
    }
    bumpCount(branchNode.counts, status);

    let zoneNode = branchNode.zones.get(zoneName);
    if (!zoneNode) {
      zoneNode = {
        name: zoneName,
        counts: emptyCountBag(),
        regions: new Map(),
      };
      branchNode.zones.set(zoneName, zoneNode);
    }
    bumpCount(zoneNode.counts, status);

    let regionNode = zoneNode.regions.get(regionName);
    if (!regionNode) {
      regionNode = {
        name: regionName,
        counts: emptyCountBag(),
        devices: [],
      };
      zoneNode.regions.set(regionName, regionNode);
    }
    bumpCount(regionNode.counts, status);

    const device = mapDeviceRow(hit, cutoff);
    device.branch = branchName;
    device.zone = zoneName;
    device.region = regionName;
    device.orgName = orgName;
    regionNode.devices.push(device);
  }

  const data = [...byOrg.values()]
    .map((orgNode) => {
      const orgRollup = finalizeNodeCounts(orgNode.counts);
      const branches = [...orgNode.branches.values()]
        .map((branchNode) => {
          const branchRollup = finalizeNodeCounts(branchNode.counts);
          const zones = [...branchNode.zones.values()]
            .map((zoneNode) => {
              const zoneRollup = finalizeNodeCounts(zoneNode.counts);
              const regions = [...zoneNode.regions.values()]
                .map((regionNode) => {
                  const regionRollup = finalizeNodeCounts(regionNode.counts);
                  return {
                    name: regionNode.name,
                    type: 'region',
                    ...regionRollup,
                    devices: regionNode.devices,
                  };
                })
                .sort(sortByName);
              return {
                name: zoneNode.name,
                type: 'zone',
                ...zoneRollup,
                regions,
              };
            })
            .sort(sortByName);
          return {
            name: branchNode.name,
            type: 'branch',
            ...branchRollup,
            zones,
          };
        })
        .sort(sortByName);

      return {
        id: orgNode.orgId,
        orgId: orgNode.orgId,
        name: orgNode.name,
        type: 'organization',
        ...orgRollup,
        branches,
      };
    })
    .sort(sortByName);

  // Optional search: keep orgs/branches that match
  let filtered = data;
  if (hasFilterValue(filters.search)) {
    const q = String(filters.search).trim().toLowerCase();
    filtered = data.filter((org) => {
      if (org.name.toLowerCase().includes(q) || org.orgId.toLowerCase().includes(q)) {
        return true;
      }
      return org.branches.some(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.zones.some(
            (z) =>
              z.name.toLowerCase().includes(q) ||
              z.regions.some(
                (r) =>
                  r.name.toLowerCase().includes(q) ||
                  r.devices.some((d) =>
                    String(d.hostname || d.sysname || '')
                      .toLowerCase()
                      .includes(q)
                  )
              )
          )
      );
    });
  }

  return {
    total: filtered.length,
    data: filtered,
    appliedFilters: filters,
  };
}
