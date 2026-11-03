import { client } from '../../opensearch/client.js';
import {
  FLOWS_INDEX,
  deviceIdFilter,
  resolveTimeRange,
} from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404;
}

async function searchOrEmpty(params) {
  try {
    const { body } = await client.search(params);
    return body;
  } catch (err) {
    if (isIndexMissing(err)) return null;
    throw err;
  }
}

const SUM_PACKETS_SCRIPT =
  "double a = doc.containsKey('csp') && doc['csp'].size()!=0 ? doc['csp'].value : 0; " +
  "double b = doc.containsKey('scp') && doc['scp'].size()!=0 ? doc['scp'].value : 0; " +
  'return a + b;';

const SUM_BYTES_SCRIPT =
  "double a = doc.containsKey('csb') && doc['csb'].size()!=0 ? doc['csb'].value : 0; " +
  "double b = doc.containsKey('scb') && doc['scb'].size()!=0 ? doc['scb'].value : 0; " +
  'return a + b;';

/** Prefer the non-ephemeral side so 9200/443 show instead of a random client port. */
const SERVICE_PORT_SCRIPT =
  'long d = 0L; long s = 0L; ' +
  "if (doc.containsKey('dport') && doc['dport'].size() != 0) { d = (long) doc['dport'].value; } " +
  "if (doc.containsKey('sport') && doc['sport'].size() != 0) { s = (long) doc['sport'].value; } " +
  'boolean de = d >= 32768L; boolean se = s >= 32768L; ' +
  'if (de && !se && s > 0L) return s; ' +
  'if (se && !de && d > 0L) return d; ' +
  'if (d > 0L && s > 0L) return d < s ? d : s; ' +
  'return d > 0L ? d : s;';

function flowsQuery(deviceId, fromTime, toTime) {
  return {
    bool: {
      filter: [
        deviceIdFilter(deviceId),
        { range: { fs: { gte: fromTime, lt: toTime } } },
      ],
    },
  };
}

function bucketTimeMs(key) {
  const n = Number(key);
  if (!Number.isFinite(n)) return 0;
  return n > 1e12 ? n : n * 1000;
}

function directionRow(bucket, extra = {}) {
  const upload = bucket.sent?.value || 0;
  const download = bucket.received?.value || 0;
  return {
    ...extra,
    flows: bucket.doc_count || 0,
    upload,
    download,
    total: upload + download,
  };
}

function wrap(device, fromTime, toTime, extra) {
  return {
    deviceId: device.id,
    hostname: device.hostname,
    range: { from: fromTime, to: toTime },
    ...extra,
  };
}

/**
 * Category data usage from `flows`.
 */
export async function getDataUsage(deviceId, from, to, session = {}, point = 120) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime } = resolveTimeRange(from, to);
  const span = Math.max(1, toTime - fromTime);
  const interval = span <= 300 ? 60 : Math.floor(span / Math.max(1, point));

  const body = await searchOrEmpty({
    index: FLOWS_INDEX,
    body: {
      size: 0,
      track_total_hits: true,
      query: flowsQuery(device.id, fromTime, toTime),
      aggs: {
        app_name: {
          terms: { field: 'cat.keyword', size: 50 },
          aggs: {
            histogram: {
              histogram: {
                field: 'fs',
                interval,
                min_doc_count: 0,
                extended_bounds: { min: fromTime, max: toTime },
              },
              aggs: {
                pkts: { sum: { script: SUM_PACKETS_SCRIPT } },
                byts: { sum: { script: SUM_BYTES_SCRIPT } },
              },
            },
            unq: { cardinality: { field: 'nid.keyword' } },
            pkts: { sum: { script: SUM_PACKETS_SCRIPT } },
            byts: { sum: { script: SUM_BYTES_SCRIPT } },
          },
        },
        records: { value_count: { field: 'nid.keyword' } },
        destinations: { cardinality: { field: 'dh.keyword' } },
        sources: { cardinality: { field: 'sh.keyword' } },
        sent: { sum: { field: 'csb' } },
        received: { sum: { field: 'scb' } },
        protocols: {
          terms: { field: 'proto.keyword', size: 10 },
          aggs: {
            sent: { sum: { field: 'csb' } },
            received: { sum: { field: 'scb' } },
          },
        },
        ports: {
          terms: {
            script: { lang: 'painless', source: SERVICE_PORT_SCRIPT },
            size: 15,
          },
          aggs: {
            sent: { sum: { field: 'csb' } },
            received: { sum: { field: 'scb' } },
            proto: { terms: { field: 'proto.keyword', size: 1 } },
          },
        },
      },
    },
  });

  const byCategory = {};
  const byCategoryPackets = {};
  const byCategoryRecords = {};
  const historical = { bytes: [], packets: [] };
  let totalBytes = 0;
  let totalPackets = 0;
  const totalRecords = body?.aggregations?.records?.value ?? body?.hits?.total?.value ?? 0;
  const destinations = body?.aggregations?.destinations?.value || 0;
  const sources = body?.aggregations?.sources?.value || 0;
  const upload = body?.aggregations?.sent?.value || 0;
  const download = body?.aggregations?.received?.value || 0;

  for (const appBucket of body?.aggregations?.app_name?.buckets || []) {
    const appName = appBucket.key;
    const packets = [];
    const bytes = [];

    for (const bucket of appBucket.histogram?.buckets || []) {
      packets.push([bucketTimeMs(bucket.key), bucket.pkts.value]);
      bytes.push([bucketTimeMs(bucket.key), bucket.byts.value]);
    }

    if (packets.length || bytes.length) {
      historical.bytes.push({ data: bytes, name: appName });
      historical.packets.push({ data: packets, name: appName });
    }

    byCategory[appName] = appBucket.byts.value;
    byCategoryPackets[appName] = appBucket.pkts?.value || 0;
    byCategoryRecords[appName] = appBucket.unq?.value || 0;
    totalBytes += appBucket.byts.value;
    totalPackets += appBucket.pkts.value;
  }

  const protocols = (body?.aggregations?.protocols?.buckets || [])
    .map((bucket) => directionRow(bucket, { name: bucket.key }))
    .sort((a, b) => b.total - a.total);

  const ports = (body?.aggregations?.ports?.buckets || [])
    .map((bucket) => {
      const proto = String(bucket.proto?.buckets?.[0]?.key || '').toUpperCase();
      return directionRow(bucket, {
        port: Math.round(Number(bucket.key)),
        proto: proto || '—',
      });
    })
    .filter((row) => row.port > 0 && (row.proto === 'TCP' || row.proto === 'UDP'))
    .sort((a, b) => b.total - a.total);

  return wrap(device, fromTime, toTime, {
    interval,
    byCategory,
    byCategoryPackets,
    byCategoryRecords,
    historical,
    protocols,
    ports,
    total: {
      bytes: totalBytes,
      packets: totalPackets,
      records: totalRecords,
      destinations,
      sources,
      upload,
      download,
    },
  });
}

/**
 * IP-based usage from `flows`.
 */
export async function getIpDataUsage(deviceId, from, to, session = {}) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime } = resolveTimeRange(from, to);

  const body = await searchOrEmpty({
    index: FLOWS_INDEX,
    body: {
      size: 0,
      query: flowsQuery(device.id, fromTime, toTime),
      aggs: {
        source_ips: {
          terms: { field: 'sh.keyword', size: 100 },
          aggs: {
            sent: { sum: { field: 'csb' } },
            received: { sum: { field: 'scb' } },
            mac: { terms: { field: 'sm.keyword', size: 1 } },
          },
        },
        dest_ips: {
          terms: { field: 'dh.keyword', size: 100 },
          aggs: {
            sent: { sum: { field: 'csb' } },
            received: { sum: { field: 'scb' } },
            mac: { terms: { field: 'dm.keyword', size: 1 } },
          },
        },
      },
    },
  });

  const ipMap = {};

  for (const bucket of body?.aggregations?.source_ips?.buckets || []) {
    const sent = bucket.sent?.value || 0;
    const received = bucket.received?.value || 0;
    ipMap[bucket.key] = {
      ip: bucket.key,
      mac: bucket.mac?.buckets?.[0]?.key || null,
      upload: sent,
      download: received,
      total: sent + received,
    };
  }

  for (const bucket of body?.aggregations?.dest_ips?.buckets || []) {
    const sent = bucket.sent?.value || 0;
    const received = bucket.received?.value || 0;
    if (ipMap[bucket.key]) {
      ipMap[bucket.key].upload += sent;
      ipMap[bucket.key].download += received;
      ipMap[bucket.key].total += sent + received;
    } else {
      ipMap[bucket.key] = {
        ip: bucket.key,
        mac: bucket.mac?.buckets?.[0]?.key || null,
        upload: sent,
        download: received,
        total: sent + received,
      };
    }
  }

  const ips = Object.values(ipMap).sort((a, b) => b.total - a.total);
  return wrap(device, fromTime, toTime, { ips });
}
