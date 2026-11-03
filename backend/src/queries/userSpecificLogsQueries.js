import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const LOG_SOURCE = Object.freeze([
  'uid',
  'devId',
  'task',
  'taskId',
  'type',
  'cmd',
  'prog',
  'args',
  'created',
  'sent',
  'process',
  'result',
  'status',
  'msg',
  'lastupdated',
  'file',
]);

function hasValue(value) {
  return value != null && String(value).trim() !== '';
}

function hitTotal(body) {
  const total = body?.hits?.total;
  if (typeof total === 'number') return total;
  return Number(total?.value) || 0;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

/**
 * Match keyword / plain / numeric field variants (tasklog mapping may vary).
 */
function flexibleTerm(field, value, { numeric = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const should = [];
  const n = Number(raw);
  const isNumeric = Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(raw);

  if (numeric || isNumeric) {
    if (!isNumeric) return null;
    should.push({ term: { [field]: n } });
  } else {
    should.push({ term: { [field]: raw } });
    should.push({ term: { [`${field}.keyword`]: raw } });
  }

  return { bool: { should, minimum_should_match: 1 } };
}

/**
 * User-specific task logs (`tasklog`) have no orgId/branchId.
 * Super Admin sees all; everyone else is limited to own uid.
 */
function buildUserSpecificSessionFilters(session = {}) {
  if (session.isSuperAdmin) return [];

  // Role string fallback when only JWT role is available
  const role = String(session.role || '').trim();
  if (role === 'super_admin' || role === '99') return [];

  const userId = String(session.userId || '').trim();
  if (!userId) return [{ match_none: {} }];

  const clause = flexibleTerm('uid', userId);
  return clause ? [clause] : [{ match_none: {} }];
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

async function mapIds(index, ids, sourceFields = []) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  try {
    const { body } = await client.mget({
      index,
      body: {
        docs: uniqueIds.map((id) => ({
          _id: id,
          ...(sourceFields.length ? { _source: sourceFields } : {}),
        })),
      },
    });

    const map = new Map();
    for (const doc of body?.docs || []) {
      if (!doc?.found) continue;
      map.set(String(doc._id), doc._source || {});
    }
    return map;
  } catch (err) {
    if (isIndexMissing(err)) return new Map();
    throw err;
  }
}

function mapUserSpecificLogHit(hit, rowNo, accessMap, deviceMap) {
  const src = hit?._source || {};
  const uidValue = String(src.uid || '');
  const devIdValue = String(src.devId || '');

  return {
    id: hit?._id,
    no: rowNo,
    uid: uidValue,
    user: accessMap.get(uidValue)?.email || '',
    devId: devIdValue,
    hostname: deviceMap.get(devIdValue)?.sysname || '',
    task: src.task ?? '',
    taskId: src.taskId ?? '',
    type: src.type ?? '',
    cmd: src.cmd ?? '',
    prog: src.prog ?? '',
    created: src.created ?? null,
    sent: src.sent ?? null,
    process: src.process ?? null,
    result: src.result ?? null,
    status: src.status ?? null,
    statusLabel: statusLabel(src.status),
    msg: src.msg ?? '',
    lastupdated: src.lastupdated ?? null,
    file: src.file ?? '',
  };
}

/**
 * List user-specific task logs from INDICES.TASKS_LOGS (`tasklog`).
 * Filters: uid, devId, task, type, status, fromTime, toTime, search, page, pageSize.
 * Session scoping via second argument (Super Admin = all; others = own uid).
 */
export async function listUserSpecificLogs(filters = {}, session = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 50, 1), 500);
  const must = [...buildUserSpecificSessionFilters(session)];

  if (hasValue(filters.uid)) {
    const clause = flexibleTerm('uid', filters.uid);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.devId)) {
    const clause = flexibleTerm('devId', filters.devId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.task)) {
    must.push({ match_phrase: { task: String(filters.task).trim() } });
  }

  if (hasValue(filters.type)) {
    const clause = flexibleTerm('type', filters.type);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.status)) {
    const status = String(filters.status).trim().toLowerCase();
    if (status === 'success' || status === '0') {
      must.push({ term: { status: 0 } });
    } else if (status === 'pending' || status === 'missing') {
      must.push({
        bool: {
          must_not: [{ exists: { field: 'status' } }],
        },
      });
    } else if (status === 'failed') {
      must.push({
        bool: {
          must: [{ exists: { field: 'status' } }],
          must_not: [{ term: { status: 0 } }],
        },
      });
    } else {
      const clause = flexibleTerm('status', filters.status, { numeric: true });
      if (clause) must.push(clause);
    }
  }

  if (hasValue(filters.fromTime) || hasValue(filters.toTime)) {
    const range = {};
    if (hasValue(filters.fromTime)) range.gte = Number(filters.fromTime);
    if (hasValue(filters.toTime)) range.lte = Number(filters.toTime);
    must.push({ range: { created: range } });
  }

  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['task', 'type', 'cmd', 'prog', 'msg', 'uid', 'devId', 'taskId'],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };

  try {
    const { body } = await client.search({
      index: INDICES.TASKS_LOGS,
      body: {
        query,
        sort: [{ created: { order: 'desc', unmapped_type: 'long' } }],
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
        _source: [...LOG_SOURCE],
      },
    });

    const hits = body?.hits?.hits || [];
    const uidIds = hits.map((h) => h?._source?.uid).filter(Boolean);
    const devIds = hits.map((h) => h?._source?.devId).filter(Boolean);

    const [accessMap, deviceMap] = await Promise.all([
      mapIds(INDICES.USERS, uidIds, ['email']),
      mapIds(INDICES.DEVICES, devIds, ['sysname']),
    ]);

    const logs = hits.map((hit, index) =>
      mapUserSpecificLogHit(
        hit,
        (page - 1) * pageSize + index + 1,
        accessMap,
        deviceMap
      )
    );

    return {
      logs,
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { logs: [], total: 0, page, pageSize };
    }
    throw err;
  }
}
