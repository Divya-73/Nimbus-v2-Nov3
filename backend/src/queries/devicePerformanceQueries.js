import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  DEVICE_STATUS,
  buildSessionFilters,
  getActivityCutoff,
  getCpuPercent,
  getDeviceStatus,
  getLanDetail,
  getLanInterfaceStatus,
  getLteDetail,
  getLteInterfaceStatus,
  getWanDetail,
  liveLinkFilterStatus,
  getMemoryUsagePercent,
  getSdwanStatus,
  getUptime,
  isAssigned,
  isOnline,
  countInterfaceMap,
} from '../config/deviceStatusConfig.js';
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';
import { fetchOrgNamesByIds, resolveOrgName } from './orgNameLookup.js';
import { listIpv4, normalizeIps, pickGuiIp } from './deviceGuiQueries.js';
import { fetchOnlineSinceByHits } from './reachabilityQueries.js';

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 500;

/** Lean + interface fields needed for live-performance rows. */
const PERF_SOURCE = {
  includes: [
    'sysname',
    'devId',
    'model',
    'version',
    'phase',
    'tags',
    'orgId',
    'org',
    'branchId',
    'branch',
    'zone',
    'region',
    'slu',
    'lastupdated',
    'datecreated',
    'uptime',
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
    'iftrans_temp',
    'interface_name',
    'ips',
    'cpu.per',
    'cpu.btime',
    'mem.mper',
    'outlet_name',
    'outlet_code',
    'ro_code',
    'sales_area',
    'automation_vendor',
  ],
};

function hasFilterValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function assignedMustClause() {
  return {
    bool: {
      must: [{ exists: { field: 'orgId' } }, { exists: { field: 'branchId' } }],
      must_not: [{ term: { 'orgId.keyword': '' } }, { term: { 'branchId.keyword': '' } }],
    },
  };
}

function buildHostnameSearchClause(searchValue) {
  const search = String(searchValue || '').trim();
  if (!search) return null;

  return {
    bool: {
      should: [
        { term: { 'sysname.keyword': { value: search, boost: 20 } } },
        { match_phrase_prefix: { sysname: { query: search, boost: 8 } } },
        {
          multi_match: {
            query: search,
            fields: ['sysname', 'model', 'branch', 'org', 'outlet_name'],
            fuzziness: 'AUTO',
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildStructuralMust(filters = {}, session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];

  if (hasFilterValue(filters.orgId)) {
    must.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }
  if (hasFilterValue(filters.branchId)) {
    must.push({ term: { 'branchId.keyword': String(filters.branchId).trim() } });
  }
  if (hasFilterValue(filters.zone)) {
    must.push({ term: { 'zone.keyword': String(filters.zone).trim() } });
  }
  if (hasFilterValue(filters.region)) {
    must.push({ term: { 'region.keyword': String(filters.region).trim() } });
  }
  if (hasFilterValue(filters.branch)) {
    must.push({ term: { 'branch.keyword': String(filters.branch).trim() } });
  }
  if (hasFilterValue(filters.org)) {
    must.push({ term: { 'org.keyword': String(filters.org).trim() } });
  }
  if (hasFilterValue(filters.model)) {
    must.push({ term: { 'model.keyword': String(filters.model).trim() } });
  }

  const searchClause = hasFilterValue(filters.search)
    ? buildHostnameSearchClause(filters.search)
    : null;
  if (searchClause) must.push(searchClause);

  return must;
}

function formatDateOnly(value) {
  if (value === undefined || value === null || value === '') return 'N/A';

  const numeric = Number(value);
  const epochSeconds = Number.isFinite(numeric)
    ? numeric > 2_000_000_000_000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric)
    : null;

  const date =
    epochSeconds !== null ? new Date(epochSeconds * 1000) : new Date(String(value));

  if (Number.isNaN(date.getTime())) return 'N/A';

  const pad = (num) => String(num).padStart(2, '0');
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ampm = hours24 >= 12 ? 'PM' : 'AM';

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(hours12)}:${minutes}:${seconds} ${ampm}`;
}

function normalizeVersion(value) {
  const text = String(value || '').trim();
  if (!text) return 'N/A';
  const match = text.match(/\d+(?:\.\d+)+/);
  if (match) return match[0];
  const cleaned = text.replace(/[^0-9.]+/g, '');
  return cleaned || 'N/A';
}

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeLinkFilter(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function needsJsStatusFilter(filters = {}) {
  return (
    hasFilterValue(filters.sdwanStatus) ||
    hasFilterValue(filters.status) ||
    hasFilterValue(filters.lanStatus) ||
    hasFilterValue(filters.lteStatus) ||
    hasFilterValue(filters.lte1Status) ||
    hasFilterValue(filters.lte2Status) ||
    hasFilterValue(filters.wanStatus)
  );
}

function matchesStatusFilters(device, filters, cutoff) {
  if (hasFilterValue(filters.status)) {
    const want = normalizeStatus(filters.status);
    const got = getDeviceStatus(device, cutoff);
    if (want === 'up' && got !== DEVICE_STATUS.UP) return false;
    if (want === 'down' && got !== DEVICE_STATUS.DOWN) return false;
    if (want === 'onboard') return false;
  }

  if (hasFilterValue(filters.sdwanStatus)) {
    const want = normalizeLinkFilter(filters.sdwanStatus);
    const got = getSdwanStatus(device, cutoff).status;
    if (want === 'UP' && got !== 'UP') return false;
    if (want === 'DOWN' && got !== 'DOWN') return false;
  }

  if (hasFilterValue(filters.lanStatus)) {
    const want = normalizeLinkFilter(filters.lanStatus);
    const got = String(getLanInterfaceStatus(device, cutoff) || '').toUpperCase();
    if (want === 'UP' && got !== 'UP') return false;
    if (want === 'DOWN' && got !== 'DOWN') return false;
    if ((want === 'NA' || want === 'N/A') && got !== 'NA') return false;
  }

  if (hasFilterValue(filters.lte1Status)) {
    const want = normalizeLinkFilter(filters.lte1Status);
    const got = getLteInterfaceStatus(device, 'SIM1', cutoff);
    if (want === 'UP' && got !== 'up') return false;
    if (want === 'DOWN' && got !== 'down') return false;
    if ((want === 'NA' || want === 'N/A') && got !== 'na') return false;
  } else if (hasFilterValue(filters.lte2Status)) {
    const want = normalizeLinkFilter(filters.lte2Status);
    const got = getLteInterfaceStatus(device, 'SIM2', cutoff);
    if (want === 'UP' && got !== 'up') return false;
    if (want === 'DOWN' && got !== 'down') return false;
    if ((want === 'NA' || want === 'N/A') && got !== 'na') return false;
  } else if (hasFilterValue(filters.lteStatus)) {
    const want = normalizeLinkFilter(filters.lteStatus);
    const got = liveLinkFilterStatus(getLteDetail(device, cutoff));
    if (want === 'UP' && got !== 'UP') return false;
    if (want === 'DOWN' && got !== 'DOWN') return false;
    if ((want === 'NA' || want === 'N/A') && got !== 'N/A') return false;
  }

  if (hasFilterValue(filters.wanStatus)) {
    const want = normalizeLinkFilter(filters.wanStatus);
    const got = liveLinkFilterStatus(getWanDetail(device, cutoff));
    if (want === 'UP' && got !== 'UP') return false;
    if (want === 'DOWN' && got !== 'DOWN') return false;
    if ((want === 'NA' || want === 'N/A') && got !== 'N/A') return false;
  }

  return true;
}

async function mapPerformanceRows(hits, cutoff, orgNamesById, branchNamesById) {
  const onlineSinceById = await fetchOnlineSinceByHits(hits, cutoff);
  return hits.map((hit) => {
    const src = hit._source || {};
    const since = onlineSinceById[hit._id] ?? onlineSinceById[src.devId] ?? null;
    return mapPerformanceRow(hit, cutoff, orgNamesById, branchNamesById, since);
  });
}

function mapPerformanceRow(hit, cutoff, orgNamesById, branchNamesById, onlineSince = null) {
  const src = hit._source || {};
  const orgName = resolveOrgName(src, orgNamesById) || src.org || 'N/A';
  const branchName = resolveBranchName(src, branchNamesById) || src.branch || 'N/A';

  const status = getDeviceStatus(src, cutoff);
  const cpuPer = getCpuPercent(src);
  const memory = getMemoryUsagePercent(src);
  const ips = normalizeIps(src.ips);
  const ipv4 = listIpv4(ips);

  let tags = 'N/A';
  if (typeof src.tags === 'string' && src.tags.trim()) tags = src.tags.trim();
  else if (Array.isArray(src.tags) && src.tags.length) tags = src.tags.join(', ');

  return {
    id: hit._id,
    hostname: src.sysname || 'Unknown',
    org: orgName,
    orgId: src.orgId || '',
    branch: branchName,
    branchId: src.branchId || '',
    zone: src.zone || 'N/A',
    region: src.region || 'N/A',
    model: src.model || 'N/A',
    version: normalizeVersion(src.version),
    phase: src.phase || 'N/A',
    tags,

    outletName: src.outlet_name || 'N/A',
    sapCode: src.outlet_code || 'N/A',
    jdeCode: src.ro_code || 'N/A',
    salesArea: src.sales_area || 'N/A',
    automationVendor: src.automation_vendor || 'N/A',

    status,
    sdwanStatus: getSdwanStatus(src, cutoff),
    lan: getLanDetail(src, cutoff),
    wan: getWanDetail(src, cutoff),
    lte: getLteDetail(src, cutoff),

    // Live CPU/MEM from devices index (same as device list)
    cpu: Number(cpuPer.toFixed(2)),
    memory: Number(memory.toFixed(2)),
    uptime: getUptime(src, cutoff, onlineSince),

    lastBoot: formatDateOnly(src.cpu?.btime),
    lastUpdated: formatDateOnly(src.lastupdated),
    dateCreated: formatDateOnly(src.datecreated),

    ips,
    ipv4,
    guiIp: pickGuiIp(ips),

    isOnline: isOnline(src, cutoff) && status === DEVICE_STATUS.UP,
    interfaceMapCount: countInterfaceMap(src),
  };
}

/**
 * Paginated live performance table.
 * All live metrics from devices index (same CPU/MEM path as device list).
 * LAN/LTE/WAN rich rows: getLanDetail / getLteDetail / getWanDetail
 * (missing iface → N/A, present but not up → DOWN, live up → UP).
 */
export async function getLivePerformance(filters = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE, session = {}) {
  const cutoff = getActivityCutoff();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const must = buildStructuralMust(filters, session);
  const query = { bool: { must } };
  const useJsFilter = needsJsStatusFilter(filters);

  const sortBy = hasFilterValue(filters.sortBy) ? String(filters.sortBy).trim() : 'lastupdated';
  const sortOrder = String(filters.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const searching = hasFilterValue(filters.search);
  const sort = useJsFilter
    ? undefined
    : searching
      ? [{ _score: { order: 'desc' } }, { [sortBy]: { order: sortOrder } }]
      : [{ [sortBy]: { order: sortOrder } }];

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      query,
      sort,
      from: useJsFilter ? 0 : (safePage - 1) * safeSize,
      size: useJsFilter ? Math.min(10000, MAX_PAGE_SIZE * 20) : safeSize,
      track_total_hits: true,
      _source: PERF_SOURCE,
    },
  });

  let hits = (body.hits?.hits || []).filter((h) => isAssigned(h._source || {}));

  if (useJsFilter) {
    hits = hits.filter((h) => matchesStatusFilters(h._source || {}, filters, cutoff));
    hits.sort((a, b) => {
      const av = a._source?.[sortBy] ?? 0;
      const bv = b._source?.[sortBy] ?? 0;
      if (av === bv) return 0;
      return av > bv ? (sortOrder === 'asc' ? 1 : -1) : sortOrder === 'asc' ? -1 : 1;
    });
    const total = hits.length;
    const start = (safePage - 1) * safeSize;
    hits = hits.slice(start, start + safeSize);

    const orgIds = [...new Set(hits.map((h) => h._source?.orgId).filter(Boolean))];
    const branchIds = [...new Set(hits.map((h) => h._source?.branchId).filter(Boolean))];
    const [orgNamesById, branchNamesById] = await Promise.all([
      fetchOrgNamesByIds(orgIds),
      fetchBranchNamesByIds(branchIds),
    ]);

    return {
      devices: await mapPerformanceRows(hits, cutoff, orgNamesById, branchNamesById),
      total,
      page: safePage,
      pageSize: safeSize,
    };
  }

  const total = body.hits?.total?.value ?? hits.length;
  const orgIds = [...new Set(hits.map((h) => h._source?.orgId).filter(Boolean))];
  const branchIds = [...new Set(hits.map((h) => h._source?.branchId).filter(Boolean))];
  const [orgNamesById, branchNamesById] = await Promise.all([
    fetchOrgNamesByIds(orgIds),
    fetchBranchNamesByIds(branchIds),
  ]);

  return {
    devices: await mapPerformanceRows(hits, cutoff, orgNamesById, branchNamesById),
    total,
    page: safePage,
    pageSize: safeSize,
  };
}

/**
 * Filter dropdown options for live performance (assigned devices, session-scoped).
 */
export async function getPerformanceFilterOptions(session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];
  const query = { bool: { must } };

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 0,
      query,
      aggs: {
        organizations: {
          terms: { field: 'org.keyword', size: 500, order: { _key: 'asc' } },
          aggs: {
            orgId: { terms: { field: 'orgId.keyword', size: 1 } },
          },
        },
        branches: {
          terms: { field: 'branch.keyword', size: 1000, order: { _key: 'asc' } },
          aggs: {
            branchId: { terms: { field: 'branchId.keyword', size: 1 } },
            orgId: { terms: { field: 'orgId.keyword', size: 1 } },
          },
        },
        zones: {
          terms: { field: 'zone.keyword', size: 100, order: { _key: 'asc' } },
        },
        regions: {
          terms: { field: 'region.keyword', size: 200, order: { _key: 'asc' } },
        },
        models: {
          terms: { field: 'model.keyword', size: 200, order: { _key: 'asc' } },
        },
      },
    },
  });

  const aggs = body.aggregations || {};

  const organizations = (aggs.organizations?.buckets || [])
    .filter((b) => b.key)
    .map((b) => ({
      id: b.orgId?.buckets?.[0]?.key || b.key,
      name: String(b.key),
    }));

  const branches = (aggs.branches?.buckets || [])
    .filter((b) => b.key)
    .map((b) => ({
      id: b.branchId?.buckets?.[0]?.key || b.key,
      name: String(b.key),
      orgId: b.orgId?.buckets?.[0]?.key || '',
    }));

  return {
    organizations,
    branches,
    zones: (aggs.zones?.buckets || []).map((b) => b.key).filter(Boolean),
    regions: (aggs.regions?.buckets || []).map((b) => b.key).filter(Boolean),
    models: (aggs.models?.buckets || []).map((b) => b.key).filter(Boolean),
  };
}
