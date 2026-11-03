import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';

const BUCKET_SECONDS = 60;

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404;
}

function round2(value) {
  return parseFloat(Number(value).toFixed(2));
}

function toRate(sum, seconds = BUCKET_SECONDS) {
  if (sum == null || !Number.isFinite(Number(sum))) return null;
  const n = Number(sum);
  return round2(n > 0 ? n / seconds : 0);
}

function sumValue(agg) {
  const n = Number(agg?.value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function emptyPlanes() {
  return {
    dataPlane: { rx: [], tx: [] },
    managementPlane: { rx: [], tx: [] },
  };
}

function seriesStats(series) {
  const values = (series || [])
    .map((point) => Number(point?.[1]))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return { min: 0, max: 0, avg: 0 };
  const sum = values.reduce((acc, n) => acc + n, 0);
  return {
    min: round2(Math.min(...values)),
    max: round2(Math.max(...values)),
    avg: round2(sum / values.length),
  };
}

async function fetchTrafficSeries(deviceId, fromTime, toTime) {
  try {
    const { body } = await client.search({
      index: INDICES.TRAFFIC_DETAILS,
      body: {
        size: 0,
        track_total_hits: false,
        query: {
          bool: {
            filter: [
              deviceIdFilter(deviceId),
              { range: { lu: { gte: fromTime, lt: toTime } } },
            ],
          },
        },
        aggs: {
          rxB: { sum: { field: 'rxB' } },
          txB: { sum: { field: 'txB' } },
          rxP: { sum: { field: 'rxP' } },
          txP: { sum: { field: 'txP' } },
          timeline: {
            histogram: {
              field: 'lu',
              interval: BUCKET_SECONDS,
              min_doc_count: 1,
            },
            aggs: {
              rxB: { sum: { field: 'rxB' } },
              txB: { sum: { field: 'txB' } },
              rxP: { sum: { field: 'rxP' } },
              txP: { sum: { field: 'txP' } },
            },
          },
        },
      },
    });
    return body.aggregations || {};
  } catch (err) {
    if (isIndexMissing(err)) return {};
    throw err;
  }
}

/**
 * Device traffic from `nettrans` for the selected range.
 * Each doc is a ~30s per-interface sample. Totals are sums of `rxB`/`txB` (bytes)
 * and `rxP`/`txP` (packets). Chart rates are those sums per 1-minute bucket.
 */
export async function getDeviceTraffic(deviceId, from, to, session = {}) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime } = resolveTimeRange(from, to);
  const aggs = await fetchTrafficSeries(device.id, fromTime, toTime);

  const { dataPlane, managementPlane } = emptyPlanes();
  for (const bucket of aggs.timeline?.buckets || []) {
    const tsMs = Number(bucket.key) * 1000;
    dataPlane.rx.push([tsMs, toRate(bucket.rxB?.value)]);
    dataPlane.tx.push([tsMs, toRate(bucket.txB?.value)]);
    managementPlane.rx.push([tsMs, toRate(bucket.rxP?.value)]);
    managementPlane.tx.push([tsMs, toRate(bucket.txP?.value)]);
  }

  const lastSampleAt = dataPlane.rx.length
    ? dataPlane.rx[dataPlane.rx.length - 1][0]
    : null;

  return {
    deviceId: device.id,
    hostname: device.hostname,
    range: { from: fromTime, to: toTime },
    dataPlane,
    managementPlane,
    summary: {
      points: dataPlane.rx.length,
      lastSampleAt,
      totals: {
        download: sumValue(aggs.rxB),
        upload: sumValue(aggs.txB),
        packetsRx: sumValue(aggs.rxP),
        packetsTx: sumValue(aggs.txP),
      },
      dataPlane: {
        rx: seriesStats(dataPlane.rx),
        tx: seriesStats(dataPlane.tx),
      },
      managementPlane: {
        rx: seriesStats(managementPlane.rx),
        tx: seriesStats(managementPlane.tx),
      },
    },
  };
}
