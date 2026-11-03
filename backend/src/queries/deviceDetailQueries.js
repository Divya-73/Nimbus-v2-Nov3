import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  DEVICE_STATUS,
  buildSessionFilters,
  getActivityCutoff,
  getCpuPercent,
  getDeviceStatus,
  formatLanInterfaceLabel,
  listLanInterfacePorts,
  getLanInterfaceStatus,
  getLteInterfaceStatus,
  getMemoryUsagePercent,
  getSdwanStatus,
  getUptime,
  isAssigned,
} from '../config/deviceStatusConfig.js';
import { normalizeIps, pickGuiIp, listIpv4 } from './deviceGuiQueries.js';
import { fetchOnlineSinceByHits } from './reachabilityQueries.js';
import { fetchOrgNamesByIds, resolveOrgName } from './orgNameLookup.js';
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';

function fmtEpoch(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'N/A';
  return new Date(n * 1000).toLocaleString();
}

function mapMac(raw) {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

/**
 * Full device payload for Device Performance (and telemetry tabs).
 */
export function mapDeviceDetail(hit, cutoff, onlineSince = null) {
  const src = hit._source || {};
  const status = getDeviceStatus(src, cutoff);
  const cpuPer = getCpuPercent(src);
  const ips = normalizeIps(src.ips);
  const guiIp = pickGuiIp(ips);
  const mac = mapMac(src.mac);

  return {
    id: hit._id,
    hostname: src.sysname || 'Unknown',
    model: src.model || 'N/A',
    manufacturer: src.manufacturer || 'N/A',
    version: src.version || 'N/A',
    siteId: src.site_id || 'N/A',
    nmId: src.nmId || 'N/A',

    orgId: src.orgId || 'N/A',
    org: src.org || src.org_name || 'N/A',
    orgName: src.org_name || src.org || 'N/A',
    branchId: src.branchId || 'N/A',
    branch: src.branch || 'N/A',
    branchType: src.branch_type || 'N/A',
    zone: src.zone || 'N/A',
    region: src.region || 'N/A',
    address: src.address || 'N/A',
    tags: src.tags ?? 'N/A',

    status,
    isOnline: status === DEVICE_STATUS.UP,
    active: Number(src.active) === 1,
    lanStatus: getLanInterfaceStatus(src, cutoff),
    lte1Status: getLteInterfaceStatus(src, 'SIM1', cutoff),
    lte2Status: getLteInterfaceStatus(src, 'SIM2', cutoff),
    sdwanStatus: getSdwanStatus(src, cutoff),
    lan1: src.LAN1 || 'N/A',
    lanIfaces: formatLanInterfaceLabel(src, 'N/A', cutoff),
    lanPorts: listLanInterfacePorts(src, cutoff),
    sim1: src.SIM1 || 'N/A',
    sim2: src.SIM2 || 'N/A',
    sstp: src.SSTP || 'N/A',

    cpu: cpuPer.toFixed(2),
    cpuDetail: {
      processes: src.cpu?.procs ?? null,
      idle: src.cpu?.idle ?? null,
      system: src.cpu?.sys ?? null,
      irq: src.cpu?.irq ?? null,
      softirq: src.cpu?.softirq ?? null,
    },
    memory: getMemoryUsagePercent(src).toFixed(2),
    memoryDetail: {
      total: src.mem?.mt ?? null,
      used: src.mem?.mu ?? null,
      free: src.mem?.mf ?? null,
      cache: src.mem?.cache ?? null,
      buff: src.mem?.buff ?? null,
    },
    uptime: getUptime(src, cutoff, onlineSince),
    uptimeSeconds: Number(src.uptime) || 0,
    lastBoot: fmtEpoch(src.cpu?.btime),
    lastUpdated: fmtEpoch(src.lastupdated),
    lastSeen: fmtEpoch(src.slu),
    nmLastUpdated: fmtEpoch(src.nmclu),
    dateCreated: fmtEpoch(src.datecreated),

    ips,
    ipv4: listIpv4(ips),
    guiIp,
    mac,
    interfaces: Array.isArray(src.interfaces) ? src.interfaces : [],

    lat: src.lat ?? 'N/A',
    long: src.long ?? 'N/A',
    email: src.email || 'N/A',
    phone: src.phone || 'N/A',
    web: src.web || 'N/A',

    pipeline: src.pipeline || 'N/A',
    latencyPolicy: src.latency || null,
    jitterPolicy: src.jitter || null,
  };
}

/**
 * GET full device document for detail view (scoped).
 */
export async function getDeviceDetail(deviceId, session = {}) {
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }

  const cutoff = getActivityCutoff();
  let body;

  try {
    ({ body } = await client.get({
      index: INDICES.DEVICES,
      id: String(deviceId).trim(),
      // Full document — detail page needs more than lean list fields
    }));
  } catch (err) {
    if (err?.meta?.statusCode === 404 || err?.statusCode === 404) {
      throw new Error('Device not found');
    }
    throw err;
  }

  if (!body?.found) {
    throw new Error('Device not found');
  }

  const src = body._source || {};
  if (!isAssigned(src)) {
    throw new Error('Device not found');
  }

  const scopeFilters = buildSessionFilters(session);
  if (scopeFilters.length) {
    const { body: check } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: 1,
        query: {
          bool: {
            filter: [...scopeFilters, { ids: { values: [body._id] } }],
          },
        },
        _source: false,
      },
    });
    if (!(check.hits?.hits || []).length) {
      throw new Error('Device not found');
    }
  }

  const onlineSinceById = await fetchOnlineSinceByHits(
    [{ _id: body._id, _source: src }],
    cutoff
  );
  const onlineSince = onlineSinceById[body._id] ?? onlineSinceById[src.devId] ?? null;
  return mapDeviceDetail({ _id: body._id, _source: src }, cutoff, onlineSince);
}

function catalogId(value) {
  const id = String(value || '').trim();
  if (!id || id === 'N/A') return '';
  return id;
}

/** Fill org/branch display names from catalog indices when the device doc has ids but blank labels. */
export async function attachOrgBranchNames(device = {}) {
  const orgId = catalogId(device.orgId);
  const branchId = catalogId(device.branchId);
  const [orgNames, branchNames] = await Promise.all([
    fetchOrgNamesByIds(orgId ? [orgId] : []),
    fetchBranchNamesByIds(branchId ? [branchId] : []),
  ]);
  const orgName = resolveOrgName({ orgId, org: device.org }, orgNames);
  const branchName = resolveBranchName({ branchId, branch: device.branch }, branchNames);
  return {
    ...device,
    org: orgName || 'N/A',
    orgName: orgName || 'N/A',
    branch: branchName || 'N/A',
  };
}
