import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { deviceIdFilter, resolveTimeRange } from '../config/livePerformanceConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';

const JOB_SOURCE = Object.freeze([
  'uid',
  'task',
  'taskId',
  'type',
  'cmd',
  'prog',
  'created',
  'sent',
  'process',
  'result',
  'status',
  'msg',
  'lastupdated',
]);

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;
const MSG_MAX = 220;

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

function statusLabel(status) {
  if (status === null || typeof status === 'undefined' || status === '') {
    return 'Pending';
  }
  const n = Number(status);
  if (Number.isFinite(n) && n === 0) return 'Success';
  if (Number.isFinite(n)) return 'Failed';
  return String(status);
}

function clipMsg(value, max = MSG_MAX) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Result is often an epoch or short code — never dump nested MQTT args. */
function safeResult(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return '';
  if (typeof value === 'number') return value;
  return clipMsg(value, 120);
}

/** Compact job kind for the General panel (template / reboot / group / …). */
function jobKind(src = {}) {
  const blob = `${src.task || ''} ${src.type || ''} ${src.cmd || ''}`.toLowerCase();
  if (blob.includes('reboot')) return 'Reboot';
  if (blob.includes('template') || src.cmd === 'uci') return 'Template';
  if (blob.includes('firmware') || blob.includes('upgrade') || src.cmd === 'sysup') {
    return 'Upgrade';
  }
  if (blob.includes('group') || String(src.type || '').toLowerCase() === 'group') {
    return 'Group action';
  }
  if (src.cmd === 'cmd') return 'Command';
  const type = String(src.type || '').trim();
  if (type && type.toLowerCase() !== 'adhoc') return type;
  const task = String(src.task || '').trim();
  return task || 'Job';
}

async function mapUserEmails(uids) {
  const uniqueIds = [...new Set((uids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  try {
    const { body } = await client.mget({
      index: INDICES.USERS,
      body: {
        docs: uniqueIds.map((id) => ({ _id: id, _source: ['email'] })),
      },
    });

    const map = new Map();
    for (const doc of body?.docs || []) {
      if (!doc?.found) continue;
      map.set(String(doc._id), doc._source?.email || '');
    }
    return map;
  } catch (err) {
    if (isIndexMissing(err)) return new Map();
    throw err;
  }
}

function emptyPayload(device, page, pageSize) {
  return {
    hostname: device.hostname,
    deviceId: device.id,
    jobs: [],
    total: 0,
    page,
    pageSize,
    summary: { success: 0, failed: 0, pending: 0 },
  };
}

function aggCount(agg) {
  return Number(agg?.doc_count) || 0;
}

/**
 * Recent jobs for one assigned CPE (General Details panel).
 * Source: `tasklog`. Scope via getDeviceDetail. Never returns args / credentials.
 */
export async function getDeviceJobs(deviceId, filters = {}, session = {}) {
  const device = await getDeviceDetail(deviceId, session);

  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(filters.pageSize) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const must = [deviceIdFilter(device.id)];

  if (hasValue(filters.from) || hasValue(filters.to)) {
    const { fromTime, toTime } = resolveTimeRange(filters.from, filters.to);
    must.push({ range: { created: { gte: fromTime, lte: toTime } } });
  }

  let postFilter = null;
  if (hasValue(filters.status)) {
    const status = String(filters.status).trim().toLowerCase();
    if (status === 'pending') {
      postFilter = {
        bool: {
          should: [
            { bool: { must_not: [{ exists: { field: 'status' } }] } },
            { term: { status: '' } },
          ],
          minimum_should_match: 1,
        },
      };
    } else if (status === 'success') {
      postFilter = { term: { status: 0 } };
    } else if (status === 'failed') {
      postFilter = {
        bool: {
          must: [{ exists: { field: 'status' } }],
          must_not: [{ term: { status: 0 } }],
        },
      };
    }
  }

  try {
    const { body } = await client.search({
      index: INDICES.TASKS_LOGS,
      body: {
        query: { bool: { must } },
        ...(postFilter ? { post_filter: postFilter } : {}),
        sort: [{ created: { order: 'desc', unmapped_type: 'long' } }],
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
        _source: [...JOB_SOURCE],
        aggs: {
          success: { filter: { term: { status: 0 } } },
          failed: {
            filter: {
              bool: {
                must: [{ exists: { field: 'status' } }],
                must_not: [{ term: { status: 0 } }],
              },
            },
          },
          pending: {
            filter: {
              bool: { must_not: [{ exists: { field: 'status' } }] },
            },
          },
        },
      },
    });

    const hits = body?.hits?.hits || [];
    const emailMap = await mapUserEmails(hits.map((h) => h?._source?.uid));

    const jobs = hits.map((hit) => {
      const src = hit?._source || {};
      const uid = String(src.uid || '');
      return {
        id: hit?._id,
        kind: jobKind(src),
        task: src.task ?? '',
        taskId: src.taskId ?? '',
        type: src.type ?? '',
        cmd: src.cmd ?? '',
        prog: src.prog ?? '',
        created: src.created ?? null,
        sent: src.sent ?? null,
        process: src.process ?? null,
        result: safeResult(src.result),
        status: src.status ?? null,
        statusLabel: statusLabel(src.status),
        msg: clipMsg(src.msg),
        lastupdated: src.lastupdated ?? null,
        user: emailMap.get(uid) || '',
      };
    });

    return {
      hostname: device.hostname,
      deviceId: device.id,
      jobs,
      total: hitTotal(body),
      page,
      pageSize,
      summary: {
        success: aggCount(body?.aggregations?.success),
        failed: aggCount(body?.aggregations?.failed),
        pending: aggCount(body?.aggregations?.pending),
      },
    };
  } catch (err) {
    if (isIndexMissing(err)) return emptyPayload(device, page, pageSize);
    throw err;
  }
}
