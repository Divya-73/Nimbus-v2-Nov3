import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';
import { listIpv4, normalizeIps } from './deviceGuiQueries.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function hasValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function hitTotal(body) {
  const total = body?.hits?.total;
  if (typeof total === 'number') return total;
  return Number(total?.value) || 0;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404;
}

function isAggFieldMissing(err) {
  const reason = String(err?.meta?.body?.error?.reason || err?.message || '').toLowerCase();
  return reason.includes('no mapping found') || reason.includes('fielddata') || reason.includes('unknown field');
}

function addIp(set, value) {
  const ip = String(value ?? '').trim();
  if (!ip || !IPV4_RE.test(ip) || ip.startsWith('169.254.')) return;
  set.add(ip);
}

function ipsFromIftrans(iftrans) {
  const set = new Set();
  if (!iftrans || typeof iftrans !== 'object') return set;
  for (const iface of Object.values(iftrans)) {
    if (!iface || typeof iface !== 'object') continue;
    addIp(set, iface.v4);
    addIp(set, iface.ip);
  }
  return set;
}

function ipShouldClauses(ips) {
  const should = [];
  for (const ip of ips) {
    should.push({ term: { 'host.ip.keyword': ip } });
    should.push({ term: { 'host.ip': ip } });
    should.push({ match_phrase: { 'host.ip': ip } });
    should.push({ match_phrase: { host: ip } });
    should.push({ term: { 'log.source.address.keyword': ip } });
    should.push({ match_phrase: { 'log.source.address': ip } });
  }
  return should;
}

function resolveSourceIp(source = {}, fallbackIps = []) {
  const direct =
    source['host.ip'] ||
    source?.source?.ip ||
    source['source.ip'] ||
    source['log.source.address'] ||
    source?.log?.source?.address;
  if (direct) return String(direct);

  const host = source.host;
  if (typeof host === 'string' && host.trim()) return host.trim();
  if (host && typeof host === 'object') {
    return host.ip || host.hostname || host.name || fallbackIps[0] || 'unknown';
  }
  return fallbackIps[0] || 'unknown';
}

function mapLogHit(hit, fallbackIps) {
  const s = hit?._source || {};
  const host = s.host;
  return {
    id: hit?._id,
    timestamp: s['@timestamp'] || s.timestamp || null,
    message: s.message || '',
    level: s.severity?.label || s.level || 'info',
    source: resolveSourceIp(s, fallbackIps),
    host:
      typeof host === 'string'
        ? host
        : host?.hostname || host?.ip || host?.name || '',
  };
}

async function loadDeviceNetwork(deviceId) {
  try {
    const { body } = await client.get({
      index: INDICES.DEVICES,
      id: String(deviceId).trim(),
      _source_includes: ['ips', 'iftrans_temp', 'sysname'],
    });
    return body?._source || {};
  } catch (err) {
    if (err?.meta?.statusCode === 404 || err?.statusCode === 404) {
      return {};
    }
    throw err;
  }
}

/**
 * Syslog rows for one assigned CPE (Device Performance tab).
 * Device is scoped via getDeviceDetail; syslog is matched on interface IPv4s.
 */
export async function getDeviceLogs(deviceId, from, to, filters = {}, session = {}) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime, fromMs, toMs } = resolveTimeRange(from, to);

  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(filters.pageSize) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const src = await loadDeviceNetwork(device.id);
  const ipSet = ipsFromIftrans(src.iftrans_temp);
  for (const ip of listIpv4(normalizeIps(src.ips))) addIp(ipSet, ip);
  for (const ip of device.ipv4 || []) addIp(ipSet, ip);
  const ips = [...ipSet];

  const empty = {
    hostname: device.hostname,
    deviceId: device.id,
    ips,
    range: { from: fromTime, to: toTime, fromMs, toMs },
    logs: [],
    total: 0,
    page,
    pageSize,
    sources: [],
  };

  if (!ips.length) return empty;

  const must = [
    { bool: { should: ipShouldClauses(ips), minimum_should_match: 1 } },
    {
      range: {
        '@timestamp': {
          gte: fromTime * 1000,
          lte: toTime * 1000,
          format: 'epoch_millis',
        },
      },
    },
  ];

  if (hasValue(filters.level)) {
    const level = String(filters.level).trim();
    must.push({
      bool: {
        should: [
          { match_phrase: { 'severity.label': level } },
          { term: { 'severity.label.keyword': level } },
          { term: { 'level.keyword': level } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (hasValue(filters.source)) {
    const srcFilter = String(filters.source).trim();
    must.push({
      bool: {
        should: [
          { match_phrase: { 'log.source.address': srcFilter } },
          { match_phrase: { 'host.hostname': srcFilter } },
          { match_phrase: { 'host.ip': srcFilter } },
          { match_phrase: { host: srcFilter } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      bool: {
        should: [
          { match_phrase: { message: q } },
          { match: { message: { query: q, operator: 'and' } } },
          { match_phrase: { 'host.ip': q } },
          { match_phrase: { 'host.hostname': q } },
          { match_phrase: { 'log.source.address': q } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  const searchBody = {
    from: (page - 1) * pageSize,
    size: pageSize,
    track_total_hits: true,
    query: { bool: { must } },
    sort: [{ '@timestamp': { order: 'desc', unmapped_type: 'date' } }],
  };

  async function runSearch(withSourcesAgg) {
    return client.search({
      index: INDICES.SYSLOG,
      ignore_unavailable: true,
      allow_no_indices: true,
      body: withSourcesAgg
        ? {
            ...searchBody,
            aggs: {
              sources: { terms: { field: 'log.source.address.keyword', size: 50 } },
            },
          }
        : searchBody,
    });
  }

  try {
    let body;
    try {
      ({ body } = await runSearch(true));
    } catch (err) {
      if (!isAggFieldMissing(err)) throw err;
      ({ body } = await runSearch(false));
    }

    return {
      hostname: device.hostname,
      deviceId: device.id,
      ips,
      range: { from: fromTime, to: toTime, fromMs, toMs },
      logs: (body?.hits?.hits || []).map((hit) => mapLogHit(hit, ips)),
      total: hitTotal(body),
      page,
      pageSize,
      sources: (body?.aggregations?.sources?.buckets || []).map((b) => b.key).filter(Boolean),
    };
  } catch (err) {
    if (isIndexMissing(err)) return empty;
    throw err;
  }
}
