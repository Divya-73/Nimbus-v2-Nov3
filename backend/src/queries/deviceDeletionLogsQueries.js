import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const LOG_SOURCE = Object.freeze([
  'username',
  'sysname',
  'deletedTime',
  'sessionId',
  'userId',
  'org',
  'orgId',
  'branch',
  'model',
  'role',
  'onboard',
  'deviceId',
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

/** Match keyword or plain field variants (mapping may vary). */
function flexibleTerm(field, value) {
  const str = String(value ?? '').trim();
  if (!str) return null;
  return {
    bool: {
      should: [{ term: { [field]: str } }, { term: { [`${field}.keyword`]: str } }],
      minimum_should_match: 1,
    },
  };
}

/**
 * Device deletion logs have no orgId/branchId on documents.
 * Super Admin (99) sees all; everyone else is limited to own userId.
 */
function buildDeviceDeletionSessionFilters(session = {}) {
  if (session.isSuperAdmin) return [];

  const role = String(session.role || '').trim();
  if (role === 'super_admin' || role === '99') return [];

  const userId = String(session.userId || '').trim();
  if (!userId) return [{ match_none: {} }];

  const clause = flexibleTerm('userId', userId);
  return clause ? [clause] : [{ match_none: {} }];
}

function mapDeletionLogHit(hit, rowNo) {
  const src = hit?._source || {};
  return {
    id: hit?._id,
    no: rowNo,
    username: src.username ?? '',
    sysname: src.sysname ?? '',
    deletedTime: src.deletedTime ?? null,
    sessionId: src.sessionId ?? '',
    userId: src.userId ?? '',
    org: src.org || src.orgId || '',
    branch: src.branch || '',
    model: src.model || '',
    role: src.role || '',
    onboard: src.onboard === true,
    deviceId: src.deviceId || hit?._id || '',
  };
}

/**
 * List device deletion logs from INDICES.DEVICE_DELETION_LOGS (`device_deleted_logs`).
 * Filters: username, sysname, sessionId, userId, fromTime, toTime, search, page, pageSize.
 * Session scoping via second argument (Super Admin = all; others = own userId).
 */
export async function listDeviceDeletionLogs(filters = {}, session = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 50, 1), 500);
  const must = [...buildDeviceDeletionSessionFilters(session)];

  if (hasValue(filters.username)) {
    must.push({ match_phrase: { username: String(filters.username).trim() } });
  }

  if (hasValue(filters.sysname)) {
    must.push({ match_phrase: { sysname: String(filters.sysname).trim() } });
  }

  if (hasValue(filters.sessionId)) {
    const clause = flexibleTerm('sessionId', filters.sessionId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.userId)) {
    const clause = flexibleTerm('userId', filters.userId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.fromTime) || hasValue(filters.toTime)) {
    const range = {};
    if (hasValue(filters.fromTime)) range.gte = Number(filters.fromTime);
    if (hasValue(filters.toTime)) range.lte = Number(filters.toTime);
    must.push({ range: { deletedTime: range } });
  }

  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['username', 'sysname', 'sessionId', 'userId', 'org', 'branch', 'model'],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };

  try {
    const { body } = await client.search({
      index: INDICES.DEVICE_DELETION_LOGS,
      body: {
        query,
        sort: [{ deletedTime: { order: 'desc', unmapped_type: 'long' } }],
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
        _source: [...LOG_SOURCE],
      },
    });

    const hits = body?.hits?.hits || [];
    const logs = hits.map((hit, index) =>
      mapDeletionLogHit(hit, (page - 1) * pageSize + index + 1)
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
