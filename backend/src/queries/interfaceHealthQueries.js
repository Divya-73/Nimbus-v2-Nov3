import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';
import { assignedIfaceMeta, ONBOARD_IFACE_SLOTS } from '../config/deviceStatusConfig.js';
import { isIndexMissing, searchTermsAgg } from '../utils/opensearchFieldAgg.js';

function round2(value) {
  return parseFloat(Number(value).toFixed(2));
}

function asInterfaceList(iface) {
  return [...new Set(
    (Array.isArray(iface) ? iface : [iface])
      .map((name) => String(name || '').trim())
      .filter(Boolean),
  )];
}

function buildInterfaceFilterClause(interfaces = []) {
  if (!interfaces.length) return null;
  return {
    bool: {
      should: interfaces.flatMap((iface) => ([
        { term: { 'iface.keyword': iface } },
        { term: { iface } },
        { match_phrase: { iface } },
      ])),
      minimum_should_match: 1,
    },
  };
}

function histogramInterval(fromTime, toTime) {
  const span = Math.max(1, toTime - fromTime);
  if (span <= 3600) return 60;
  if (span <= 6 * 3600) return 120;
  if (span <= 86400) return 300;
  return 900;
}

/** Fine enough to catch short reporting gaps; coarse enough for 7-day queries. */
function statusInterval(fromTime, toTime) {
  const span = Math.max(1, toTime - fromTime);
  return span <= 86400 ? 60 : 300;
}

function bucketTimeSec(key) {
  const n = Number(key);
  if (!Number.isFinite(n)) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

function bucketTimeMs(key) {
  return bucketTimeSec(key) * 1000;
}

function appendInterval(rows, fromSec, toSec, status) {
  if (!(toSec > fromSec)) return;
  const last = rows[rows.length - 1];
  if (last && last.status === status && last.toSec === fromSec) {
    last.toSec = toSec;
    last.to = toSec * 1000;
    return;
  }
  rows.push({
    from: fromSec * 1000,
    to: toSec * 1000,
    fromSec,
    toSec,
    status,
  });
}

/** Sparse buckets only. Missing minutes between first and last sample = Down. */
function statusFromSparseBuckets(buckets = [], intervalSec) {
  const populated = (buckets || []).filter((point) => point?.doc_count);
  if (!populated.length) return { intervals: [], uptimePercentage: 0 };

  const intervals = [];
  let cursor = null;
  let first = null;
  let upSec = 0;
  for (const point of populated) {
    const start = bucketTimeSec(point.key);
    const end = start + intervalSec;
    const status = Number(point.up?.value) >= 0.5 ? 1 : 0;
    if (first == null) first = start;
    if (cursor != null && start > cursor) {
      appendInterval(intervals, cursor, start, 0);
    }
    appendInterval(intervals, start, end, status);
    if (status === 1) upSec += intervalSec;
    cursor = end;
  }
  const totalSec = Math.max(intervalSec, (cursor || 0) - first);
  return {
    intervals: intervals.map(({ from, to, status }) => ({ from, to, status })),
    uptimePercentage: round2((upSec / totalSec) * 100),
  };
}

function downsampleTraffic(buckets = [], sourceInterval, targetInterval) {
  const traffic = { download: [], upload: [], packetsRx: [], packetsTx: [] };
  if (!targetInterval || targetInterval <= sourceInterval) {
    for (const point of buckets) {
      if (!point?.doc_count) continue;
      const ts = bucketTimeMs(point.key);
      traffic.download.push([ts, toRate(point.rxB?.value, sourceInterval)]);
      traffic.upload.push([ts, toRate(point.txB?.value, sourceInterval)]);
      traffic.packetsRx.push([ts, toRate(point.rxP?.value, sourceInterval)]);
      traffic.packetsTx.push([ts, toRate(point.txP?.value, sourceInterval)]);
    }
    return traffic;
  }

  const grouped = new Map();
  for (const point of buckets) {
    if (!point?.doc_count) continue;
    const start = Math.floor(bucketTimeSec(point.key) / targetInterval) * targetInterval;
    const row = grouped.get(start) || { rxB: 0, txB: 0, rxP: 0, txP: 0 };
    row.rxB += Number(point.rxB?.value) || 0;
    row.txB += Number(point.txB?.value) || 0;
    row.rxP += Number(point.rxP?.value) || 0;
    row.txP += Number(point.txP?.value) || 0;
    grouped.set(start, row);
  }
  for (const [start, row] of grouped) {
    const ts = start * 1000;
    traffic.download.push([ts, toRate(row.rxB, targetInterval)]);
    traffic.upload.push([ts, toRate(row.txB, targetInterval)]);
    traffic.packetsRx.push([ts, toRate(row.rxP, targetInterval)]);
    traffic.packetsTx.push([ts, toRate(row.txP, targetInterval)]);
  }
  return traffic;
}

function ifaceQuery(deviceId, fromTime, toTime, interfaces) {
  const filter = [
    deviceIdFilter(deviceId),
    { range: { lu: { gte: fromTime, lt: toTime } } },
  ];
  const ifaceClause = buildInterfaceFilterClause(interfaces);
  if (ifaceClause) filter.push(ifaceClause);
  return { bool: { filter } };
}

function cleanIp(raw) {
  const ip = String(raw ?? '').trim();
  if (!ip || ip === '0' || ip === '0.0.0.0' || ip === '-' || ip === '::') return null;
  return ip;
}

function cleanMac(raw) {
  const mac = String(raw ?? '').trim();
  if (!mac || mac === '0' || mac === '00:00:00:00:00:00') return null;
  return mac;
}

function asCounter(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return n;
  const alt = Number(fallback);
  return Number.isFinite(alt) && alt >= 0 ? alt : 0;
}

function ifaceMeta(iftrans, name) {
  const payload = iftrans?.[String(name)] || {};
  return {
    ip: cleanIp(payload.v4),
    ipv6: cleanIp(payload.v6),
    mac: cleanMac(payload.mac),
  };
}

async function loadDeviceIfaceSource(deviceId) {
  try {
    const { body } = await client.get({
      index: INDICES.DEVICES,
      id: String(deviceId),
      _source: ['iftrans_temp', 'interface_name', ...ONBOARD_IFACE_SLOTS],
    });
    return body?._source || {};
  } catch (err) {
    if (isIndexMissing(err) || err?.meta?.statusCode === 404 || err?.statusCode === 404) {
      return {};
    }
    throw err;
  }
}

function lastSnapshot(src = {}) {
  const carrier = Number(src.carrier);
  return {
    carrier: carrier === 1 || carrier === 0 ? carrier : null,
    lastSeen: Number(src.lu) || null,
    rxB: asCounter(src.rxB),
    txB: asCounter(src.txB),
    rxP: asCounter(src.rxP),
    txP: asCounter(src.txP),
  };
}

function isLanAlias(name) {
  const n = String(name || '').trim().toLowerCase();
  return n === 'lan' || /^lan\d+$/.test(n);
}

function dropLanAliases(interfaces = []) {
  const hasBridge = interfaces.some((row) => /^br-lan/i.test(row.name));
  if (!hasBridge) return interfaces;
  return interfaces.filter((row) => !isLanAlias(row.name));
}

function toRate(sum, seconds) {
  if (sum == null || !Number.isFinite(Number(sum)) || !seconds) return 0;
  const n = Number(sum);
  return n > 0 ? round2(n / seconds) : 0;
}

function sumValue(bucket, key) {
  const n = Number(bucket?.[key]?.value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const LAST_SOURCE = ['carrier', 'lu', 'rxB', 'txB', 'rxP', 'txP'];

/**
 * Interface availability from `nettrans`.
 * Up = samples with `carrier` 1. Down = `carrier` 0 **or** a gap in samples
 * (old NIMBUS treats reporting gaps as Down). Gaps are filled in Node from sparse
 * 1-minute buckets — OpenSearch is not asked for empty minutes.
 * Each `nettrans` doc is a ~30s sample (not a lifetime counter). Download / upload /
 * packets are the **sum** of `rxB`/`txB`/`rxP`/`txP` in the selected range.
 * IP/MAC come from `devices.iftrans_temp` — they are not on `nettrans`.
 * `iface` is optional — when omitted, all interfaces in the range are returned.
 */
export async function getInterfaceHealth(deviceId, from, to, iface, session = {}) {
  const { fromTime, toTime } = resolveTimeRange(from, to);
  const requested = asInterfaceList(iface);
  const interval = histogramInterval(fromTime, toTime);
  const bucketSec = statusInterval(fromTime, toTime);
  const span = Math.max(1, toTime - fromTime);

  const [device, ifaceSrc, body] = await Promise.all([
    getDeviceDetail(deviceId, session),
    loadDeviceIfaceSource(deviceId),
    searchTermsAgg({
      index: INDICES.TRAFFIC_DETAILS,
      query: ifaceQuery(deviceId, fromTime, toTime, requested),
      parent: 'ifaces',
      fields: ['iface.keyword', 'iface'],
      size: 24,
      innerAggs: {
        histogram: {
          histogram: {
            field: 'lu',
            interval: bucketSec,
            min_doc_count: 1,
          },
          aggs: {
            up: { avg: { field: 'carrier' } },
            rxB: { sum: { field: 'rxB' } },
            txB: { sum: { field: 'txB' } },
            rxP: { sum: { field: 'rxP' } },
            txP: { sum: { field: 'txP' } },
          },
        },
        rxB: { sum: { field: 'rxB' } },
        txB: { sum: { field: 'txB' } },
        rxP: { sum: { field: 'rxP' } },
        txP: { sum: { field: 'txP' } },
        last: {
          top_hits: {
            size: 1,
            sort: [{ lu: { order: 'desc' } }],
            _source: LAST_SOURCE,
          },
        },
      },
    }),
  ]);

  const iftrans = ifaceSrc.iftrans_temp && typeof ifaceSrc.iftrans_temp === 'object'
    ? ifaceSrc.iftrans_temp
    : {};
  const interfaces = [];

  for (const bucket of body?.aggregations?.ifaces?.buckets || []) {
    const name = String(bucket.key || '').trim();
    if (!name) continue;
    const points = bucket.histogram?.buckets || [];
    const { intervals, uptimePercentage } = statusFromSparseBuckets(points, bucketSec);
    const traffic = downsampleTraffic(points, bucketSec, interval);
    const upTime = Math.round((uptimePercentage / 100) * span);
    const downTime = Math.max(0, span - upTime);
    const meta = ifaceMeta(iftrans, name);
    const assigned = assignedIfaceMeta(ifaceSrc, name);
    const last = lastSnapshot(bucket.last?.hits?.hits?.[0]?._source || {});
    const lastStatus = last.carrier;
    interfaces.push({
      name,
      slot: assigned.slot,
      label: assigned.label,
      op: assigned.op,
      con_id: assigned.con_id,
      ip: meta.ip,
      ipv6: meta.ipv6,
      mac: meta.mac,
      samples: bucket.doc_count || 0,
      lastStatus,
      last,
      totals: {
        download: sumValue(bucket, 'rxB'),
        upload: sumValue(bucket, 'txB'),
        packetsRx: sumValue(bucket, 'rxP'),
        packetsTx: sumValue(bucket, 'txP'),
      },
      traffic,
      intervals,
      uptimePercentage,
      upTime,
      downTime,
      totalTime: span,
      hasData: intervals.length > 0 || traffic.download.length > 0,
    });
  }

  const visible = dropLanAliases(interfaces);
  visible.sort((a, b) => {
    const assignedA = a.slot || a.label ? 0 : 1;
    const assignedB = b.slot || b.label ? 0 : 1;
    if (assignedA !== assignedB) return assignedA - assignedB;
    const slotA = ONBOARD_IFACE_SLOTS.indexOf(String(a.slot || '').split(',')[0].trim());
    const slotB = ONBOARD_IFACE_SLOTS.indexOf(String(b.slot || '').split(',')[0].trim());
    const slotRank = (slotA < 0 ? 99 : slotA) - (slotB < 0 ? 99 : slotB);
    if (slotRank) return slotRank;
    return b.uptimePercentage - a.uptimePercentage || a.name.localeCompare(b.name);
  });

  const upNow = visible.filter((row) => row.lastStatus === 1).length;
  const downNow = visible.filter((row) => row.lastStatus === 0).length;
  const weighted = visible.reduce((sum, row) => sum + row.uptimePercentage, 0);
  const overall = visible.length ? round2(weighted / visible.length) : 0;

  return {
    deviceId: device.id,
    hostname: device.hostname,
    range: { from: fromTime, to: toTime },
    interval,
    interfaces: visible,
    summary: {
      uptimePercentage: overall,
      uptime: Math.round((overall / 100) * span),
      downtime: Math.max(0, span - Math.round((overall / 100) * span)),
      totalTime: span,
      interfaceCount: visible.length,
      upNow,
      downNow,
    },
    hasData: visible.some((row) => row.hasData),
  };
}
