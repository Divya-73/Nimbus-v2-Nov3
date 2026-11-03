import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  ACTIVITY_WINDOW_SECONDS,
  DEVICE_STATUS,
  HEARTBEAT_SAMPLE_LIMIT,
  getDeviceStatus,
  lastSeenEpoch,
  onlineSinceFromHeartbeats,
} from '../config/deviceStatusConfig.js';

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404;
}

function collectDeviceIds(hits = []) {
  const ids = [];
  const seen = new Set();
  for (const hit of hits) {
    for (const value of [hit?._id, hit?._source?.devId]) {
      const id = String(value || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * For currently-up devices, find when the current heartbeat session started.
 * A silence longer than ACTIVITY_WINDOW_SECONDS is treated as a down period.
 */
export async function fetchOnlineSinceByHits(hits = [], cutoff) {
  const upHits = (hits || []).filter(
    (hit) => getDeviceStatus(hit?._source || {}, cutoff) === DEVICE_STATUS.UP
  );
  const ids = collectDeviceIds(upHits);
  if (!ids.length) return {};

  const now = Math.floor(Date.now() / 1000);
  const lookback = now - 7 * 86400;

  let body;
  try {
    ({ body } = await client.search({
      index: INDICES.CPU_MEMORY_DETAILS,
      body: {
        size: 0,
        track_total_hits: false,
        query: {
          bool: {
            filter: [
              { terms: { 'devId.keyword': ids } },
              { range: { slu: { gte: lookback, lte: now } } },
            ],
          },
        },
        aggs: {
          by_dev: {
            terms: { field: 'devId.keyword', size: ids.length },
            aggs: {
              recent: {
                top_hits: {
                  size: HEARTBEAT_SAMPLE_LIMIT,
                  sort: [{ slu: { order: 'desc' } }],
                  _source: ['slu'],
                },
              },
            },
          },
        },
      },
    }));
  } catch (err) {
    if (isIndexMissing(err)) return {};
    console.error('fetchOnlineSinceByHits failed:', err?.message || err);
    return {};
  }

  const samplesById = {};
  for (const bucket of body?.aggregations?.by_dev?.buckets || []) {
    const key = String(bucket.key || '').trim();
    if (!key) continue;
    samplesById[key] = (bucket.recent?.hits?.hits || [])
      .map((hit) => hit?._source?.slu)
      .filter((value) => value != null);
  }

  const onlineSinceById = {};
  for (const hit of upHits) {
    const src = hit._source || {};
    const lastSeen = lastSeenEpoch(src);
    const sampleIds = [hit._id, src.devId].map((value) => String(value || '').trim()).filter(Boolean);
    const samples = sampleIds.flatMap((id) => samplesById[id] || []);
    const since = onlineSinceFromHeartbeats(lastSeen, samples, ACTIVITY_WINDOW_SECONDS);
    if (since == null) continue;
    for (const id of sampleIds) onlineSinceById[id] = since;
  }

  return onlineSinceById;
}
