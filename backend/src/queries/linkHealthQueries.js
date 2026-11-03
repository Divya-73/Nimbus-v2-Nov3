import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';
import {
  isIndexMissing,
  isMappingFieldError,
  searchTermsAgg,
} from '../utils/opensearchFieldAgg.js';

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return parseFloat(n.toFixed(2));
}

function histogramInterval(fromTime, toTime) {
  const span = Math.max(1, toTime - fromTime);
  if (span <= 3600) return 60;
  if (span <= 6 * 3600) return 120;
  if (span <= 86400) return 300;
  return 900;
}

function bucketTimeSec(key) {
  const n = Number(key);
  if (!Number.isFinite(n)) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

function bucketTimeMs(key) {
  return bucketTimeSec(key) * 1000;
}

function lastSeenMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '0' || text === '-' || text === 'N/A') return null;
  return text;
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
  if (!populated.length) return { intervals: [], uptimePercentage: 0, lastStatus: null };

  const intervals = [];
  let cursor = null;
  let first = null;
  let upSec = 0;
  let lastStatus = null;
  for (const point of populated) {
    const start = bucketTimeSec(point.key);
    const end = start + intervalSec;
    const status = Number(point.up?.doc_count) > 0 ? 1 : 0;
    lastStatus = status;
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
    uptimePercentage: round2((upSec / totalSec) * 100) || 0,
    lastStatus,
  };
}

function seriesFromHist(buckets = [], field) {
  const out = [];
  for (const point of buckets) {
    if (!point?.doc_count) continue;
    const value = round2(point[field]?.value);
    if (value == null) continue;
    out.push([bucketTimeMs(point.key), value]);
  }
  return out;
}

function statsOf(series = []) {
  const values = series.map((point) => Number(point?.[1])).filter((n) => Number.isFinite(n));
  if (!values.length) return { min: null, avg: null, max: null, last: null };
  const sum = values.reduce((acc, n) => acc + n, 0);
  return {
    min: round2(Math.min(...values)),
    avg: round2(sum / values.length),
    max: round2(Math.max(...values)),
    last: round2(values[values.length - 1]),
  };
}

function namedSet(device = {}, keys = []) {
  return new Set(
    keys
      .map((key) => cleanText(device[key]))
      .filter(Boolean),
  );
}

function pathKind(name, device) {
  const n = String(name || '').trim();
  const lte = namedSet(device, ['sim1', 'sim2']);
  if (lte.has(n) || /^lte/i.test(n)) return 'lte';
  if (/^wan/i.test(n)) return 'wan';
  return 'other';
}

function kindRank(kind) {
  if (kind === 'lte') return 0;
  if (kind === 'wan') return 1;
  return 2;
}

function idClause(field, value) {
  return {
    bool: {
      should: [
        { term: { [`${field}.keyword`]: value } },
        { term: { [field]: value } },
        { match_phrase: { [field]: value } },
      ],
      minimum_should_match: 1,
    },
  };
}

function linkDeviceFilter(deviceId, device = {}) {
  const values = [...new Set(
    [deviceId, device.id, device.nmId]
      .map((value) => String(value || '').trim())
      .filter((value) => value && value !== 'N/A'),
  )];
  if (!values.length) return deviceIdFilter(deviceId);
  return {
    bool: {
      should: values.flatMap((value) => [idClause('devId', value), idClause('nmId', value)]),
      minimum_should_match: 1,
    },
  };
}

async function lastAt(index, deviceId, device, extraMaxField) {
  try {
    const aggs = { lastLu: { max: { field: 'lu' } } };
    if (extraMaxField) aggs.lastExtra = { max: { field: extraMaxField } };
    const { body } = await client.search({
      index,
      body: {
        size: 0,
        track_total_hits: false,
        query: { bool: { filter: [linkDeviceFilter(deviceId, device)] } },
        aggs,
      },
    });
    const lu = Number(body?.aggregations?.lastLu?.value);
    const extra = Number(body?.aggregations?.lastExtra?.value);
    const latest = Math.max(
      Number.isFinite(lu) ? lu : 0,
      Number.isFinite(extra) ? extra : 0,
    );
    return latest > 0 ? lastSeenMs(latest) : null;
  } catch (err) {
    if (isIndexMissing(err) || isMappingFieldError(err)) return null;
    throw err;
  }
}

function lastProbeAt(deviceId, device) {
  return lastAt(INDICES.JITTER_LATENCY_DETAILS, deviceId, device, 'ls');
}

function lastRadioAt(deviceId, device) {
  return lastAt(INDICES.LTE_DETAILS, deviceId, device);
}

async function searchTwtrans(deviceId, device, fromTime, toTime, interval) {
  const query = {
    bool: {
      filter: [
        linkDeviceFilter(deviceId, device),
        {
          bool: {
            should: [
              { range: { lu: { gte: fromTime, lt: toTime } } },
              { range: { ls: { gte: fromTime, lt: toTime } } },
            ],
            minimum_should_match: 1,
          },
        },
      ],
      must_not: [
        { term: { status: -1 } },
        { match_phrase: { status: -1 } },
      ],
    },
  };

  const histAggs = {
    latency: { avg: { field: 'rtmed' } },
    jitter: { avg: { field: 'twj' } },
    loss: { avg: { field: 'lostp' } },
    up: {
      filter: {
        bool: {
          should: [
            { term: { status: 1 } },
            { term: { 'status.keyword': '1' } },
            { match_phrase: { status: 1 } },
          ],
          minimum_should_match: 1,
        },
      },
    },
  };

  const lastSource = ['name', 'dev', 'addr', 'status', 'rtmed', 'twj', 'lostp', 'sent', 'lost', 'lu'];

  // twtrans.dev may be text (dev.keyword) or keyword (dev) depending on index age.
  return searchTermsAgg({
    index: INDICES.JITTER_LATENCY_DETAILS,
    query,
    parent: 'paths',
    fields: ['dev.keyword', 'dev'],
    size: 24,
    innerAggs: {
      histogram: {
        histogram: { field: 'lu', interval, min_doc_count: 1 },
        aggs: histAggs,
      },
      last: {
        top_hits: {
          size: 1,
          sort: [{ lu: { order: 'desc' } }],
          _source: lastSource,
        },
      },
    },
  });
}

async function searchLtetrans(deviceId, device, fromTime, toTime, interval) {
  const query = {
    bool: {
      filter: [
        linkDeviceFilter(deviceId, device),
        { range: { lu: { gte: fromTime, lt: toTime } } },
      ],
    },
  };
  const histAggs = {
    sig: { avg: { field: 'sig' } },
    rssi: { avg: { field: 'rssi' } },
    rsrp: { avg: { field: 'rsrp' } },
    rsrq: { avg: { field: 'rsrq' } },
    sinr: { avg: { field: 'sinr' } },
  };
  const lastSource = [
    'iface', 'op', 'sim', 'addr', 'sig', 'rssi', 'rsrp', 'rsrq', 'sinr',
    'rns', 'pdss', 'snts', 'imei', 'band', 'lu',
  ];

  // ltetrans.iface may be text (iface.keyword) or keyword (iface).
  return searchTermsAgg({
    index: INDICES.LTE_DETAILS,
    query,
    parent: 'radios',
    fields: ['iface.keyword', 'iface'],
    size: 8,
    innerAggs: {
      histogram: {
        histogram: { field: 'lu', interval, min_doc_count: 1 },
        aggs: histAggs,
      },
      last: {
        top_hits: {
          size: 1,
          sort: [{ lu: { order: 'desc' } }],
          _source: lastSource,
        },
      },
    },
  });
}

function radioRank(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'lte1') return 0;
  if (n === 'lte2') return 1;
  if (n.startsWith('3g-lte1') || n.includes('lte1')) return 2;
  if (n.startsWith('3g-lte2') || n.includes('lte2')) return 3;
  return 4;
}

/**
 * Link Health: WAN/LTE probe quality from `twtrans`, plus LTE radio
 * (operator / signal) from `ltetrans` when that device actually has it.
 */
export async function getLinkHealth(deviceId, from, to, session = {}) {
  const { fromTime, toTime } = resolveTimeRange(from, to);
  const interval = histogramInterval(fromTime, toTime);
  const device = await getDeviceDetail(deviceId, session);
  const [body, radioBody] = await Promise.all([
    searchTwtrans(deviceId, device, fromTime, toTime, interval),
    searchLtetrans(deviceId, device, fromTime, toTime, interval),
  ]);

  const paths = [];
  for (const bucket of body?.aggregations?.paths?.buckets || []) {
    const name = String(bucket.key || '').trim();
    if (!name) continue;
    const lastSrc = bucket.last?.hits?.hits?.[0]?._source || {};
    const hist = bucket.histogram?.buckets || [];
    const latency = seriesFromHist(hist, 'latency');
    const jitter = seriesFromHist(hist, 'jitter');
    const loss = seriesFromHist(hist, 'loss');
    const { intervals, uptimePercentage, lastStatus: fromHist } = statusFromSparseBuckets(hist, interval);
    const statusNum = Number(lastSrc.status);
    const lastStatus = statusNum === 1 || statusNum === 0 ? statusNum : fromHist;
    paths.push({
      name,
      kind: pathKind(name, device),
      probe: cleanText(lastSrc.name),
      target: cleanText(lastSrc.addr),
      lastStatus,
      lastSeen: lastSeenMs(lastSrc.lu),
      sent: Number(lastSrc.sent) || 0,
      lost: Number(lastSrc.lost) || 0,
      samples: bucket.doc_count || 0,
      uptimePercentage,
      intervals,
      latency: { series: latency, ...statsOf(latency) },
      jitter: { series: jitter, ...statsOf(jitter) },
      loss: { series: loss, ...statsOf(loss) },
    });
  }

  paths.sort((a, b) => {
    const kind = kindRank(a.kind) - kindRank(b.kind);
    if (kind) return kind;
    return a.name.localeCompare(b.name);
  });

  const radios = [];
  for (const bucket of radioBody?.aggregations?.radios?.buckets || []) {
    const name = String(bucket.key || '').trim();
    if (!name) continue;
    const lastSrc = bucket.last?.hits?.hits?.[0]?._source || {};
    const hist = bucket.histogram?.buckets || [];
    const signal = seriesFromHist(hist, 'sig');
    const rssi = seriesFromHist(hist, 'rssi');
    const rsrp = seriesFromHist(hist, 'rsrp');
    const rsrq = seriesFromHist(hist, 'rsrq');
    const sinr = seriesFromHist(hist, 'sinr');
    radios.push({
      name,
      operator: cleanText(lastSrc.op),
      sim: cleanText(lastSrc.sim),
      ip: cleanText(lastSrc.addr),
      network: cleanText(lastSrc.snts),
      registration: cleanText(lastSrc.rns),
      attach: cleanText(lastSrc.pdss),
      imei: cleanText(lastSrc.imei),
      band: cleanText(lastSrc.band),
      lastSeen: lastSeenMs(lastSrc.lu),
      samples: bucket.doc_count || 0,
      signal: { series: signal, ...statsOf(signal) },
      rssi: { series: rssi, ...statsOf(rssi) },
      rsrp: { series: rsrp, ...statsOf(rsrp) },
      rsrq: { series: rsrq, ...statsOf(rsrq) },
      sinr: { series: sinr, ...statsOf(sinr) },
    });
  }
  radios.sort((a, b) => radioRank(a.name) - radioRank(b.name) || a.name.localeCompare(b.name));

  const hasProbes = paths.some((row) => row.samples > 0);
  const hasRadios = radios.some((row) => row.samples > 0);
  const [lastSampleAt, lastRadioAtMs] = await Promise.all([
    hasProbes
      ? Promise.resolve(Math.max(...paths.map((row) => Number(row.lastSeen) || 0).filter(Boolean)) || null)
      : lastProbeAt(deviceId, device),
    hasRadios
      ? Promise.resolve(Math.max(...radios.map((row) => Number(row.lastSeen) || 0).filter(Boolean)) || null)
      : lastRadioAt(deviceId, device),
  ]);

  return {
    deviceId: device.id,
    hostname: device.hostname,
    range: { from: fromTime, to: toTime },
    interval,
    paths,
    radios,
    summary: {
      pathCount: paths.length,
      lteCount: paths.filter((row) => row.kind === 'lte').length,
      wanCount: paths.filter((row) => row.kind === 'wan').length,
      otherCount: paths.filter((row) => row.kind === 'other').length,
      radioCount: radios.length,
      upNow: paths.filter((row) => row.lastStatus === 1).length,
      downNow: paths.filter((row) => row.lastStatus === 0).length,
      lastSampleAt,
      lastRadioAt: lastRadioAtMs,
    },
    hasData: hasProbes || hasRadios,
  };
}
