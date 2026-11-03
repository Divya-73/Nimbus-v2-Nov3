import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404;
}

function round2(value) {
  return parseFloat(Number(value).toFixed(2));
}

function emptySeries() {
  return { cpu: [], memory: [] };
}

const BUCKET_SECONDS = 60;

function usageFromFree(freePct) {
  if (freePct == null || !Number.isFinite(Number(freePct))) return null;
  return round2(Math.max(0, 100 - Number(freePct)));
}

async function fetchHealthSeries(deviceId, fromTime, toTime) {
  try {
    const { body } = await client.search({
      index: INDICES.CPU_MEMORY_DETAILS,
      body: {
        size: 0,
        track_total_hits: false,
        query: {
          bool: {
            filter: [
              deviceIdFilter(deviceId),
              { range: { slu: { gte: fromTime, lt: toTime } } },
            ],
          },
        },
        aggs: {
          cpu_stats: { stats: { field: 'cpu.per' } },
          mem_stats: { stats: { field: 'mem.mper' } },
          timeline: {
            histogram: {
              field: 'slu',
              interval: BUCKET_SECONDS,
              min_doc_count: 1,
            },
            aggs: {
              cpu: { avg: { field: 'cpu.per' } },
              mem: { avg: { field: 'mem.mper' } },
            },
          },
        },
      },
    });
    return { aggs: body.aggregations || {} };
  } catch (err) {
    if (isIndexMissing(err)) return { aggs: {} };
    throw err;
  }
}

/**
 * CPU/memory series from systrans. Memory is usage % (100 - free).
 * Device identity comes from devices only for scope + hostname.
 */
export async function getDeviceHealth(deviceId, from, to, session = {}) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime } = resolveTimeRange(from, to);
  const { aggs } = await fetchHealthSeries(device.id, fromTime, toTime);

  const historical = emptySeries();
  for (const bucket of aggs.timeline?.buckets || []) {
    const tsMs = Number(bucket.key) * 1000;
    const cpu = bucket.cpu?.value;
    const memFree = bucket.mem?.value;
    historical.cpu.push([tsMs, cpu == null ? null : round2(cpu)]);
    historical.memory.push([tsMs, usageFromFree(memFree)]);
  }

  const cpuStats = aggs.cpu_stats || {};
  const memStats = aggs.mem_stats || {};
  const lastSampleAt = historical.cpu.length
    ? historical.cpu[historical.cpu.length - 1][0]
    : null;

  return {
    deviceId: device.id,
    hostname: device.hostname,
    range: { from: fromTime, to: toTime },
    historical,
    summary: {
      cpuMax: round2(cpuStats.max || 0),
      cpuMin: round2(cpuStats.min || 0),
      cpuAvg: cpuStats.avg == null ? 0 : round2(cpuStats.avg),
      memoryMax: usageFromFree(memStats.min) || 0,
      memoryMin: usageFromFree(memStats.max) || 0,
      memoryAvg: usageFromFree(memStats.avg) || 0,
      points: historical.cpu.length,
      lastSampleAt,
    },
  };
}
