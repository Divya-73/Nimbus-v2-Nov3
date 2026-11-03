import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { buildAlarmSessionFilters } from '../config/deviceStatusConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';
import { mapAlarmHit } from './alarmManagementQueries.js';

const ALARM_INDEX = `${INDICES.ALARM_LOGS}*`;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

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

function ticketIdFrom(source = {}) {
  return source?.apiOpenResult?.data?.display_id || source?.ticketId || '';
}

function mapBuckets(buckets, keyName) {
  return (buckets || []).map((b) => ({
    [keyName]: b.key == null || b.key === '' ? 'N/A' : String(b.key),
    count: Number(b.doc_count) || 0,
  }));
}

function emptyPayload(device, range, page, pageSize) {
  return {
    hostname: device.hostname,
    deviceId: device.id,
    range,
    alarms: [],
    total: 0,
    page,
    pageSize,
    charts: { bySeverity: [], byStatus: [], byType: [] },
  };
}

/**
 * Alarms for one assigned CPE (Device Performance tab).
 * Scope via getDeviceDetail + alarm session filters; time via resolveTimeRange.
 */
export async function getDeviceAlarms(deviceId, from, to, filters = {}, session = {}) {
  const device = await getDeviceDetail(deviceId, session);
  const { fromTime, toTime, fromMs, toMs } = resolveTimeRange(from, to);

  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(filters.pageSize) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const must = [
    ...buildAlarmSessionFilters(session),
    deviceIdFilter(device.id),
    { range: { stime: { gte: fromTime, lte: toTime } } },
  ];

  if (hasValue(filters.severity)) {
    must.push({ term: { 'slevel.keyword': String(filters.severity).trim() } });
  }
  if (hasValue(filters.state)) {
    must.push({ term: { 'state.keyword': String(filters.state).trim() } });
  }
  if (hasValue(filters.type) || hasValue(filters.alarmType)) {
    must.push({
      term: { 'type.keyword': String(filters.alarmType || filters.type).trim() },
    });
  }
  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['host', 'detail', 'policy', 'type', 'tags', 'siteId'],
        fuzziness: 'AUTO',
      },
    });
  }

  try {
    const { body } = await client.search({
      index: ALARM_INDEX,
      body: {
        query: { bool: { must } },
        sort: [{ stime: { order: 'desc', unmapped_type: 'long' } }],
        from: (page - 1) * pageSize,
        size: pageSize,
        track_total_hits: true,
        aggs: {
          by_severity: { terms: { field: 'slevel.keyword', size: 12 } },
          by_status: { terms: { field: 'state.keyword', size: 12 } },
          by_type: { terms: { field: 'type.keyword', size: 8 } },
        },
      },
    });

    return {
      hostname: device.hostname,
      deviceId: device.id,
      range: { from: fromTime, to: toTime, fromMs, toMs },
      alarms: (body?.hits?.hits || []).map((hit) => ({
        ...mapAlarmHit(hit),
        ticketId: ticketIdFrom(hit?._source),
      })),
      total: hitTotal(body),
      page,
      pageSize,
      charts: {
        bySeverity: mapBuckets(body?.aggregations?.by_severity?.buckets, 'severity'),
        byStatus: mapBuckets(body?.aggregations?.by_status?.buckets, 'status'),
        byType: mapBuckets(body?.aggregations?.by_type?.buckets, 'type'),
      },
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return emptyPayload(
        device,
        { from: fromTime, to: toTime, fromMs, toMs },
        page,
        pageSize
      );
    }
    throw err;
  }
}
