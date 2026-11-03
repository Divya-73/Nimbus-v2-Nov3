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

const MAX_SCAN = 10000;

/** Lean device fields for model rollups / detail rows. */
const MODEL_DEVICE_SOURCE = {
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

/** Same assignment gate as device / zone / region / branch lists. */
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
  if (hasFilterValue(filters.model)) {
    must.push({ term: { 'model.keyword': String(filters.model).trim() } });
  }
  if (hasFilterValue(filters.search)) {
    const q = escapeWildcard(String(filters.search).trim());
    must.push({
      bool: {
        should: [
          { wildcard: { 'model.keyword': `*${q}*` } },
          { wildcard: { 'sysname.keyword': `*${q}*` } },
          { wildcard: { 'branch.keyword': `*${q}*` } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  return must;
}

function calculateModelStatus({ total = 0, up = 0, down = 0 } = {}) {
  if (total === 0) return { status: 'unknown', color: 'gray' };
  if (down === 0) return { status: 'up', color: 'green' };
  if (up === 0) return { status: 'down', color: 'red' };
  return { status: 'partial', color: 'orange' };
}

function emptyModelRow(modelKey) {
  return {
    id: modelKey,
    model: modelKey,
    up: 0,
    down: 0,
    total: 0,
    zones: new Set(),
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

function emptyCatalogDetails() {
  return {
    version: 'N/A',
    manufacturer: 'N/A',
    wan: [],
    sim: [],
    lan: 'N/A',
    sstp: 'N/A',
  };
}

function mapModelCatalog(src = {}) {
  return {
    version: src.VERSION || 'N/A',
    manufacturer: src.MANUFACTURER || 'N/A',
    wan: [src.WAN1, src.WAN2, src.WAN3, src.WAN4, src.WAN5, src.WAN6, src.WAN7].filter(Boolean),
    sim: [src.SIM1, src.SIM2].filter(Boolean),
    lan: src.LAN1 || 'N/A',
    sstp: src.SSTP || 'N/A',
  };
}

async function fetchModelCatalogByIds(modelIds) {
  const ids = [...new Set((modelIds || []).filter(Boolean).map(String))];
  const map = {};
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.MODELS,
      body: {
        size: Math.min(ids.length, MAX_SCAN),
        query: { ids: { values: ids } },
        _source: true,
      },
    });
    for (const hit of body.hits?.hits || []) {
      map[hit._id] = mapModelCatalog(hit._source || {});
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

async function fetchOrgNames(orgIds) {
  const unique = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = {};
  if (!unique.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: Math.min(unique.length, MAX_SCAN),
        query: { ids: { values: unique } },
        _source: ['org_name', 'org'],
      },
    });
    for (const hit of body.hits?.hits || []) {
      const src = hit._source || {};
      map[hit._id] = src.org_name || src.org || 'N/A';
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

function finalizeModelRow(row, catalog = {}, orgNames = {}) {
  const deviceCount = {
    total: row.total,
    up: row.up,
    down: row.down,
    upPercentage: row.total > 0 ? Math.round((row.up / row.total) * 100) : 0,
  };
  const rollup = calculateModelStatus(deviceCount);
  const details = catalog[row.model] || emptyCatalogDetails();
  const orgIds = [...row.orgs.keys()];
  const orgNameList = orgIds
    .map((id) => orgNames[id] || row.orgs.get(id) || id)
    .sort((a, b) => a.localeCompare(b));
  const zones = [...row.zones].sort((a, b) => a.localeCompare(b));
  const regions = [...row.regions].sort((a, b) => a.localeCompare(b));

  return {
    id: row.id,
    model: row.model,
    manufacturer: details.manufacturer,
    version: details.version,
    wan: details.wan,
    sim: details.sim,
    lan: details.lan,
    sstp: details.sstp,
    zones,
    zoneCount: zones.length,
    regions,
    regionCount: regions.length,
    orgNames: orgNameList,
    orgCount: orgNameList.length,
    deviceCount,
    status: rollup.status,
    statusColor: rollup.color,
    modelStatus: rollup.status,
    modelStatusColor: rollup.color,
  };
}

/**
 * Model list — lean device fetch + JS status from deviceStatusConfig,
 * enriched with catalog fields from the models index.
 */
export async function getModelList(filters = {}, session = {}) {
  const cutoff = getActivityCutoff();
  const must = buildStructuralMust(filters, session);
  must.push({ exists: { field: 'model' } });
  must.push({
    bool: { must_not: [{ term: { 'model.keyword': '' } }] },
  });

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: MAX_SCAN,
      track_total_hits: true,
      query: { bool: { must } },
      _source: MODEL_DEVICE_SOURCE,
    },
  });

  const byModel = new Map();

  for (const hit of body.hits?.hits || []) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;

    const modelKey = src.model != null ? String(src.model).trim() : '';
    if (!modelKey) continue;

    let row = byModel.get(modelKey);
    if (!row) {
      row = emptyModelRow(modelKey);
      byModel.set(modelKey, row);
    }

    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;

    row.total += 1;
    if (status === DEVICE_STATUS.UP) row.up += 1;
    else row.down += 1;

    if (src.zone) row.zones.add(String(src.zone).trim());
    if (src.region) row.regions.add(String(src.region).trim());
    if (src.orgId) {
      const name =
        src.org != null && String(src.org).trim() ? String(src.org).trim() : String(src.orgId);
      row.orgs.set(String(src.orgId), name);
    }
  }

  const modelIds = [...byModel.keys()];
  const allOrgIds = [...byModel.values()].flatMap((r) => [...r.orgs.keys()]);
  const [catalog, orgNames] = await Promise.all([
    fetchModelCatalogByIds(modelIds),
    fetchOrgNames(allOrgIds),
  ]);

  const data = [...byModel.values()]
    .map((row) => finalizeModelRow(row, catalog, orgNames))
    .sort((a, b) => a.model.localeCompare(b.model));

  return {
    total: data.length,
    data,
    appliedFilters: filters,
  };
}

/**
 * Single model + its assigned devices (same status classifiers as device list).
 */
export async function getModelByName(modelName, filters = {}, session = {}) {
  const name = String(modelName || '').trim();
  if (!name) {
    const err = new Error('Model name is required');
    err.status = 400;
    throw err;
  }

  const cutoff = getActivityCutoff();
  const must = buildStructuralMust({ ...filters, model: name, search: undefined }, session);

  const [catalogMap, deviceSearch] = await Promise.all([
    fetchModelCatalogByIds([name]),
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
        _source: MODEL_DEVICE_SOURCE,
      },
    }),
  ]);

  const catalog = catalogMap[name] || emptyCatalogDetails();
  const body = deviceSearch.body;

  let up = 0;
  let down = 0;
  const devices = [];

  for (const hit of body.hits?.hits || []) {
    const src = hit._source || {};
    if (!isAssigned(src)) continue;
    const status = getDeviceStatus(src, cutoff);
    if (status !== DEVICE_STATUS.UP && status !== DEVICE_STATUS.DOWN) continue;
    if (status === DEVICE_STATUS.UP) up += 1;
    else down += 1;
    devices.push(mapDeviceRow(hit, cutoff));
  }

  const deviceCount = {
    total: devices.length,
    up,
    down,
    upPercentage: devices.length > 0 ? Math.round((up / devices.length) * 100) : 0,
  };
  const rollup = calculateModelStatus(deviceCount);

  return {
    data: {
      id: name,
      model: name,
      manufacturer: catalog.manufacturer,
      version: catalog.version,
      wan: catalog.wan,
      sim: catalog.sim,
      lan: catalog.lan,
      sstp: catalog.sstp,
      deviceCount,
      status: rollup.status,
      statusColor: rollup.color,
      modelStatus: rollup.status,
      modelStatusColor: rollup.color,
      devices,
      appliedFilters: filters,
    },
  };
}

/**
 * Filter dropdown options for model list (scoped by session).
 */
export async function getModelFilterOptions(session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];
  must.push({ exists: { field: 'model' } });
  must.push({
    bool: { must_not: [{ term: { 'model.keyword': '' } }] },
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
          terms: { field: 'zone.keyword', size: 200, order: { _key: 'asc' } },
        },
        regions: {
          terms: { field: 'region.keyword', size: 200, order: { _key: 'asc' } },
        },
        models: {
          terms: { field: 'model.keyword', size: 500, order: { _key: 'asc' } },
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
    regions: (aggs.regions?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
    models: (aggs.models?.buckets || []).map((b) => ({
      name: b.key,
      count: b.doc_count,
    })),
  };
}
 