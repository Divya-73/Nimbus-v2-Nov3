import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { buildAlarmSessionFilters } from '../config/deviceStatusConfig.js';

const ALARM_INDEX = `${INDICES.ALARM_LOGS}*`;

const ALARM_TIME_RANGE_SECONDS = Object.freeze({
  '1h': 3600,
  '6h': 21600,
  '12h': 43200,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
});

function hasValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function escapeWildcard(value) {
  return String(value).replace(/[\\*?]/g, '\\$&');
}

function hitTotal(body) {
  const total = body?.hits?.total;
  if (typeof total === 'number') return total;
  return Number(total?.value) || 0;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

/** Prefer display name from alarmlog [id, name] arrays. */
function alarmLabel(value) {
  if (Array.isArray(value)) return value[1] || value[0] || 'N/A';
  return value || 'N/A';
}

function firstOf(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function buildAlarmMust(filters = {}, session = {}) {
  const must = [...buildAlarmSessionFilters(session)];

  if (hasValue(filters.severity)) {
    must.push({ term: { 'slevel.keyword': String(filters.severity).trim() } });
  }
  if (hasValue(filters.state)) {
    must.push({ term: { 'state.keyword': String(filters.state).trim() } });
  }
  if (hasValue(filters.org)) {
    must.push({ term: { 'org.keyword': String(filters.org).trim() } });
  }
  if (hasValue(filters.branch)) {
    must.push({ term: { 'branch.keyword': String(filters.branch).trim() } });
  }
  if (hasValue(filters.alarmType) || hasValue(filters.type)) {
    must.push({
      term: { 'type.keyword': String(filters.alarmType || filters.type).trim() },
    });
  }
  if (hasValue(filters.objectLevel) || hasValue(filters.olevel)) {
    must.push({
      term: { 'olevel.keyword': String(filters.objectLevel || filters.olevel).trim() },
    });
  }
  if (hasValue(filters.policy)) {
    must.push({ term: { 'policy.keyword': String(filters.policy).trim() } });
  }
  if (hasValue(filters.tags)) {
    const tags = escapeWildcard(String(filters.tags).trim());
    must.push({ wildcard: { 'tags.keyword': `*${tags}*` } });
  }
  if (hasValue(filters.host) || hasValue(filters.hostname)) {
    must.push({
      match_phrase: { host: String(filters.host || filters.hostname).trim() },
    });
  }
  if (hasValue(filters.siteId)) {
    must.push({ term: { 'siteId.keyword': String(filters.siteId).trim() } });
  }
  if (hasValue(filters.devId)) {
    must.push({ term: { 'devId.keyword': String(filters.devId).trim() } });
  }
  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['host', 'detail', 'policy', 'type', 'tags', 'siteId', 'devId'],
        fuzziness: 'AUTO',
      },
    });
  }

  if (hasValue(filters.timeRange)) {
    const seconds =
      ALARM_TIME_RANGE_SECONDS[filters.timeRange] ?? ALARM_TIME_RANGE_SECONDS['24h'];
    must.push({
      range: { stime: { gte: Math.floor(Date.now() / 1000) - seconds } },
    });
  }

  return must;
}

export function mapAlarmHit(hit) {
  const s = hit?._source || {};
  const endRaw = s.etime;
  const endTime =
    endRaw === '' || endRaw == null ? null : Number.isFinite(Number(endRaw)) ? Number(endRaw) : endRaw;

  return {
    id: hit?._id,
    startTime: s.stime ?? null,
    endTime,
    severityLevel: s.slevel || 'N/A',
    alarmStatus: s.state || 'N/A',
    hostname: s.host || 'N/A',
    siteId: s.siteId || '',
    organization: alarmLabel(s.org),
    orgId: String(firstOf(s.org) || ''),
    branch: alarmLabel(s.branch),
    branchId: String(firstOf(s.branch) || ''),
    tags: s.tags || '',
    policyName: s.policy || 'N/A',
    alarmType: s.type || 'N/A',
    detail: s.detail || '',
    objectType: s.olevel || 'N/A',
    devId: s.devId || '',
    clearedBy: s.cuserid || '',
  };
}

/**
 * List alarm logs.
 * Supports limit/offset (dashboard) or page/pageSize (management).
 */
export async function getAlarmLogs(limit = 50, offset = 0, filters = {}, session = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(filters.pageSize) || Number(limit) || 50, 1),
    500
  );
  const size =
    filters.pageSize != null || filters.page != null
      ? pageSize
      : Math.min(Math.max(Number(limit) || 50, 1), 500);
  const from =
    filters.page != null
      ? Math.max((page - 1) * size, 0)
      : Math.max(Number(offset) || 0, 0);

  const must = buildAlarmMust(filters, session);

  try {
    const { body } = await client.search({
      index: ALARM_INDEX,
      body: {
        query: { bool: { must: must.length ? must : [{ match_all: {} }] } },
        sort: [{ stime: { order: 'desc', unmapped_type: 'long' } }],
        from,
        size,
        track_total_hits: true,
      },
    });

    return {
      total: hitTotal(body),
      alarms: (body?.hits?.hits || []).map(mapAlarmHit),
      page: Math.floor(from / size) + 1,
      pageSize: size,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { total: 0, alarms: [], page: 1, pageSize: size };
    }
    throw err;
  }
}

/** Distinct filter values for dropdowns. */
export async function getAlarmFilterOptions(session = {}) {
  const sessionFilters = buildAlarmSessionFilters(session);

  try {
    const { body } = await client.search({
      index: ALARM_INDEX,
      body: {
        size: 0,
        query: sessionFilters.length
          ? { bool: { filter: sessionFilters } }
          : { match_all: {} },
        aggs: {
          unique_severities: {
            terms: { field: 'slevel.keyword', size: 50, order: { _key: 'asc' } },
          },
          unique_states: {
            terms: { field: 'state.keyword', size: 50, order: { _key: 'asc' } },
          },
          unique_types: {
            terms: { field: 'type.keyword', size: 100, order: { _key: 'asc' } },
          },
          unique_organizations: {
            terms: { field: 'org.keyword', size: 500, order: { _key: 'asc' } },
          },
          unique_branches: {
            terms: { field: 'branch.keyword', size: 500, order: { _key: 'asc' } },
          },
          unique_object_levels: {
            terms: { field: 'olevel.keyword', size: 100, order: { _key: 'asc' } },
          },
          unique_policies: {
            terms: { field: 'policy.keyword', size: 200, order: { _key: 'asc' } },
          },
          unique_tags: {
            terms: { field: 'tags.keyword', size: 200, order: { _key: 'asc' } },
          },
        },
      },
    });

    const aggs = body?.aggregations || {};
    const keys = (name) => (aggs[name]?.buckets || []).map((b) => b.key);

    return {
      severities: keys('unique_severities'),
      states: keys('unique_states'),
      types: keys('unique_types'),
      organizations: keys('unique_organizations'),
      branches: keys('unique_branches'),
      objectLevels: keys('unique_object_levels'),
      policies: keys('unique_policies'),
      tags: keys('unique_tags'),
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return {
        severities: [],
        states: [],
        types: [],
        organizations: [],
        branches: [],
        objectLevels: [],
        policies: [],
        tags: [],
      };
    }
    throw err;
  }
}

/**
 * Alarm KPI aggregations.
 * @param {object} session
 * @param {object} [filters] optional same filters as list
 */
export async function getAlarmStats(session = {}, filters = {}) {
  const must = buildAlarmMust(filters, session);

  try {
    const { body } = await client.search({
      index: ALARM_INDEX,
      body: {
        size: 0,
        query: must.length ? { bool: { must } } : { match_all: {} },
        aggs: {
          by_severity: { terms: { field: 'slevel.keyword', size: 10 } },
          by_status: { terms: { field: 'state.keyword', size: 10 } },
          by_type: { terms: { field: 'type.keyword', size: 10 } },
          recent_alarms: {
            date_histogram: {
              field: 'stime',
              calendar_interval: 'day',
              format: 'yyyy-MM-dd',
            },
          },
        },
      },
    });

    const aggs = body?.aggregations || {};
    return {
      bySeverity: (aggs.by_severity?.buckets || []).map((b) => ({
        severity: b.key,
        count: b.doc_count,
      })),
      byStatus: (aggs.by_status?.buckets || []).map((b) => ({
        status: b.key,
        count: b.doc_count,
      })),
      byType: (aggs.by_type?.buckets || []).map((b) => ({
        type: b.key,
        count: b.doc_count,
      })),
      recentTrend: (aggs.recent_alarms?.buckets || []).map((b) => ({
        date: b.key_as_string,
        count: b.doc_count,
      })),
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { bySeverity: [], byStatus: [], byType: [], recentTrend: [] };
    }
    throw err;
  }
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function notFoundError(message = 'Alarm log not found') {
  fail(message, 404);
}

function isClearedState(state) {
  const key = String(state || '').trim().toLowerCase();
  return key === 'cleared' || key === 'closed' || key === 'resolved';
}

/** Super / Org / Branch Admin (roles 99 / 7 / 1). */
export function assertCanClearAlarms(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '99' || role === '7' || role === '1') return;
  fail('You do not have permission to clear alarms', 403);
}

async function getAlarmHitById(id, session = {}) {
  const alarmId = String(id || '').trim();
  if (!alarmId) fail('Alarm id is required', 400);

  try {
    const { body } = await client.search({
      index: ALARM_INDEX,
      body: {
        size: 1,
        query: {
          bool: {
            filter: [...buildAlarmSessionFilters(session), { ids: { values: [alarmId] } }],
          },
        },
      },
    });
    const hit = body?.hits?.hits?.[0];
    if (!hit?._id) notFoundError();
    return hit;
  } catch (err) {
    if (err.status) throw err;
    if (isIndexMissing(err)) notFoundError();
    throw err;
  }
}

/**
 * Mark an alarm log Cleared:
 * state=Cleared, etime=now, cuserid=authenticated user.
 */
export async function clearAlarmLog(id, session = {}) {
  assertCanClearAlarms(session);
  const hit = await getAlarmHitById(id, session);
  const source = hit._source || {};

  if (isClearedState(source.state)) {
    return { ...mapAlarmHit(hit), alreadyCleared: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const cuserid = String(session.userId || session.email || '').trim();
  if (!cuserid) fail('Authenticated user context missing', 401);

  try {
    await client.update({
      index: hit._index,
      id: hit._id,
      body: {
        doc: {
          etime: now,
          cuserid,
          state: 'Cleared',
        },
      },
      refresh: true,
    });
  } catch (err) {
    if (isIndexMissing(err) || err?.meta?.statusCode === 404 || err?.statusCode === 404) {
      notFoundError();
    }
    throw err;
  }

  return mapAlarmHit({
    _id: hit._id,
    _source: {
      ...source,
      etime: now,
      cuserid,
      state: 'Cleared',
    },
  });
}
