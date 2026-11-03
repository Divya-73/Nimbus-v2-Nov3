import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const LOG_SOURCE = Object.freeze([
  'username',
  'remoteIp',
  'clientIp',
  'ForwardedIP',
  'loc',
  'state',
  'country',
  'sessionId',
  'platForm',
  'isMobile',
  'address',
  'source',
  'agent',
  'loginTime',
  'userId',
  'orgId',
  'branchId',
  'status',
  'success',
  'reason',
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

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

/** Match keyword or plain field variants (loginlog mapping may vary). */
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
 * Session scope for login logs.
 * Accepts either `req.scope` (with role flags) or `sessionFromReq` (orgId/branchId only).
 *
 * Super admin → no restriction.
 * Org admin / org-scoped session → orgId.
 * Branch-scoped session → orgId + branchId.
 * No org/branch (and not SA) → own userId / username.
 */
function buildLoginLogSessionFilters(session = {}) {
  if (session.isSuperAdmin) return [];

  const filters = [];
  const orgId = String(session.orgId || '').trim();
  const branchId = String(session.branchId || '').trim();
  const userId = String(session.userId || '').trim();

  // Explicit org-admin flag (controller may pass req.scope)
  if (session.isOrgAdmin === true) {
    if (!orgId) return [{ match_none: {} }];
    filters.push(flexibleTerm('orgId', orgId));
    return filters.filter(Boolean);
  }

  if (session.isBranchAdmin === true) {
    if (!orgId && !branchId) return [{ match_none: {} }];
    if (orgId) filters.push(flexibleTerm('orgId', orgId));
    if (branchId) filters.push(flexibleTerm('branchId', branchId));
    return filters.filter(Boolean);
  }

  // sessionFromReq shape: org/branch already encode SA vs OA vs BA
  if (orgId || branchId) {
    if (orgId) filters.push(flexibleTerm('orgId', orgId));
    if (branchId) filters.push(flexibleTerm('branchId', branchId));
    return filters.filter(Boolean);
  }

  // Self-only when identity is known
  if (userId) {
    filters.push(flexibleTerm('userId', userId));
  } else if (hasValue(session.username) || hasValue(session.email)) {
    filters.push({
      match_phrase: { username: String(session.username || session.email).trim() },
    });
  }

  return filters.filter(Boolean);
}

/** Resolve status for new docs and legacy success-only writes. */
function resolveLogStatus(src = {}) {
  if (hasValue(src.status)) return String(src.status).trim().toLowerCase();
  if (src.success === true) return 'success';
  if (src.success === false) return 'failed';
  // Legacy loginlog rows had no status/success — only successes were written
  return 'success';
}

function mapLoginLogHit(hit, rowNo) {
  const src = hit?._source || {};
  const status = resolveLogStatus(src);
  return {
    id: hit?._id,
    no: rowNo,
    username: src.username ?? '',
    remoteIp: src.remoteIp ?? '',
    clientIp: src.clientIp ?? '',
    ForwardedIP: src.ForwardedIP ?? '',
    loc: src.loc ?? '',
    state: src.state ?? '',
    country: src.country ?? '',
    sessionId: src.sessionId ?? '',
    platForm: src.platForm ?? '',
    isMobile: src.isMobile ?? '',
    address: src.address ?? '',
    source: src.source ?? '',
    agent: src.agent ?? '',
    loginTime: src.loginTime ?? null,
    userId: src.userId ?? '',
    orgId: src.orgId ?? '',
    branchId: src.branchId ?? '',
    status,
    success: status === 'success' || src.success === true,
    reason: src.reason ?? '',
  };
}

/**
 * List login logs (management / audit UI).
 * Filters: username, ip, userId, status, fromTime, toTime, search, page, pageSize.
 * Session scoping applied via second argument.
 */
export async function listLoginLogs(filters = {}, session = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 50, 1), 500);
  const must = [...buildLoginLogSessionFilters(session)];

  if (hasValue(filters.username)) {
    must.push({ match_phrase: { username: String(filters.username).trim() } });
  }

  if (hasValue(filters.ip)) {
    const ip = String(filters.ip).trim();
    must.push({
      bool: {
        should: [
          flexibleTerm('remoteIp', ip),
          flexibleTerm('clientIp', ip),
          flexibleTerm('ForwardedIP', ip),
          { match_phrase: { remoteIp: ip } },
        ].filter(Boolean),
        minimum_should_match: 1,
      },
    });
  }

  if (hasValue(filters.userId)) {
    const clause = flexibleTerm('userId', filters.userId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.orgId)) {
    const clause = flexibleTerm('orgId', filters.orgId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.branchId)) {
    const clause = flexibleTerm('branchId', filters.branchId);
    if (clause) must.push(clause);
  }

  if (hasValue(filters.status)) {
    const status = String(filters.status).trim().toLowerCase();
    if (status === 'success') {
      // Include legacy docs that never stored status/success (success-only era)
      must.push({
        bool: {
          should: [
            { term: { 'status.keyword': 'success' } },
            { term: { status: 'success' } },
            { term: { success: true } },
            {
              bool: {
                must_not: [
                  { exists: { field: 'status' } },
                  { exists: { field: 'success' } },
                ],
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    } else if (status === 'failed' || status === 'inactive') {
      must.push({
        bool: {
          should: [
            { term: { 'status.keyword': status } },
            { term: { status } },
            ...(status === 'failed' ? [{ term: { success: false } }] : []),
          ],
          minimum_should_match: 1,
        },
      });
    }
  }

  if (hasValue(filters.fromTime) || hasValue(filters.toTime)) {
    const range = {};
    if (hasValue(filters.fromTime)) range.gte = Number(filters.fromTime);
    if (hasValue(filters.toTime)) range.lte = Number(filters.toTime);
    must.push({ range: { loginTime: range } });
  }

  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['username', 'remoteIp', 'clientIp', 'agent', 'platForm', 'reason', 'sessionId'],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };

  try {
    const { body } = await client.search({
      index: INDICES.LOGIN_LOGS,
      body: {
        query,
        sort: [{ loginTime: { order: 'desc', unmapped_type: 'long' } }],
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
        _source: [...LOG_SOURCE],
      },
    });

    const hits = body?.hits?.hits || [];
    const logs = hits.map((hit, index) =>
      mapLoginLogHit(hit, (page - 1) * pageSize + index + 1)
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

/**
 * Insert one login audit document into INDICES.LOGIN_LOGS (`loginlog`).
 */
export async function insertLoginLog(doc = {}) {
  const body = {
    remoteIp: doc.remoteIp ?? '',
    clientIp: doc.clientIp ?? '',
    ForwardedIP: doc.ForwardedIP ?? '',
    source: doc.source ?? '',
    agent: doc.agent ?? '',
    platForm: doc.platForm ?? '',
    isMobile: doc.isMobile ?? '',
    loginTime: Number(doc.loginTime) || nowEpoch(),
    username: doc.username ?? '',
    userId: doc.userId ?? '',
    sessionId: doc.sessionId ?? '',
    orgId: doc.orgId ?? '',
    branchId: doc.branchId ?? '',
    loc: doc.loc ?? '',
    state: doc.state ?? '',
    country: doc.country ?? '',
    address: doc.address ?? '',
    status: doc.status || (doc.success === true ? 'success' : 'failed'),
    success: doc.success === true || doc.status === 'success',
    reason: doc.reason ?? '',
  };

  await client.index({
    index: INDICES.LOGIN_LOGS,
    body,
    refresh: false,
  });

  return true;
}
