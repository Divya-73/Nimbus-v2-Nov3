import { randomUUID } from 'crypto';
import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { buildSessionFilters, isAssigned } from '../config/deviceStatusConfig.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const MAX_SELECT_ALL_IDS = 10000;

const POLICY_DEVICE_SOURCE = Object.freeze([
  'sysname',
  'orgId',
  'branchId',
  'tags',
  'model',
]);

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

function isNotFound(err) {
  return (
    err?.meta?.statusCode === 404 ||
    err?.statusCode === 404 ||
    err?.meta?.body?.result === 'not_found' ||
    err?.meta?.body?.found === false
  );
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function hasValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function hitTotal(body) {
  const total = body?.hits?.total;
  if (typeof total === 'number') return total;
  return Number(total?.value) || 0;
}

function clampPage(page, pageSize) {
  const nextPage = Math.max(Number(page) || 1, 1);
  const nextSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { page: nextPage, pageSize: nextSize };
}

function escapeWildcard(value) {
  return String(value).replace(/[\\*?]/g, '\\$&');
}

function normalizeBool(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function asIdList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (value == null || value === '') return [];
  return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
}

function assignedMustClause() {
  return {
    bool: {
      must: [{ exists: { field: 'orgId' } }, { exists: { field: 'branchId' } }],
      must_not: [{ term: { 'orgId.keyword': '' } }, { term: { 'branchId.keyword': '' } }],
    },
  };
}

function mapPolicyHit(hit) {
  return {
    id: hit?._id,
    ...(hit?._source || {}),
  };
}

function notFoundError(message = 'Alarm policy not found') {
  return fail(message, 404);
}

/** Super / Org / Branch Admin (roles 99 / 7 / 1). */
export function assertCanManageAlarmPolicies(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '99' || role === '7' || role === '1') return;
  fail('You do not have permission to manage alarm policies', 403);
}

function stampScope(payload = {}, session = {}) {
  if (session.isSuperAdmin) {
    return {
      orgId: hasValue(payload.orgId) ? String(payload.orgId).trim() : '',
      branchId: hasValue(payload.branchId) ? String(payload.branchId).trim() : '',
    };
  }

  const orgId = String(session.orgId || '').trim();
  if (!orgId) fail('Organization scope is required', 403);

  return {
    orgId,
    branchId: String(session.branchId || '').trim(),
  };
}

/** When super admin omits orgId, derive it from assigned devices in include. */
function resolveScopeFromDevices(scope = {}, deviceHits = [], payload = {}, session = {}) {
  if (!session.isSuperAdmin || hasValue(scope.orgId)) return scope;

  const orgIds = [
    ...new Set(
      deviceHits
        .map((hit) => String(hit?._source?.orgId || '').trim())
        .filter(Boolean),
    ),
  ];
  if (!orgIds.length) return scope;
  if (orgIds.length > 1) {
    fail(
      'Selected devices belong to multiple organizations. Pick one org in the device picker or choose devices from a single org.',
      400,
    );
  }

  const branchIds = [
    ...new Set(
      deviceHits
        .map((hit) => String(hit?._source?.branchId || '').trim())
        .filter(Boolean),
    ),
  ];

  return {
    orgId: orgIds[0],
    branchId: hasValue(payload.branchId)
      ? String(payload.branchId).trim()
      : branchIds.length === 1
        ? branchIds[0]
        : scope.branchId,
  };
}

function policyOrgMatches(policy = {}, session = {}) {
  if (session.isSuperAdmin) return true;
  const sessionOrg = String(session.orgId || '').trim();
  const policyOrg = String(policy.orgId || '').trim();
  if (!policyOrg) return true;
  return Boolean(sessionOrg) && sessionOrg === policyOrg;
}

function assertCanWritePolicy(policy = {}, session = {}) {
  if (session.isSuperAdmin) return;
  const policyOrg = String(policy.orgId || '').trim();
  if (!policyOrg) {
    fail('Only Super Admin can change unscoped alarm policies', 403);
  }
  if (!policyOrgMatches(policy, session)) {
    notFoundError();
  }
}

function buildPolicyListQuery(filters = {}, session = {}, orgDeviceIds = []) {
  const filter = [];
  const must = [];

  if (session.isSuperAdmin) {
    if (hasValue(filters.orgId)) {
      filter.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
    }
  } else {
    const orgId = String(session.orgId || '').trim();
    if (!orgId) return { match_none: {} };

    const should = [
      { term: { 'orgId.keyword': orgId } },
      { bool: { must_not: [{ exists: { field: 'orgId' } }] } },
    ];

    // Legacy super-admin policies stored with orgId '' — match if they include this org's devices.
    if (orgDeviceIds.length) {
      should.push({
        bool: {
          filter: [
            { term: { 'orgId.keyword': '' } },
            {
              bool: {
                should: [
                  { terms: { include: orgDeviceIds } },
                  { terms: { 'include.keyword': orgDeviceIds } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      });
    }

    filter.push({
      bool: {
        should,
        minimum_should_match: 1,
      },
    });
  }

  if (hasValue(filters.deviceId)) {
    const deviceId = String(filters.deviceId).trim();
    filter.push({
      bool: {
        should: [{ term: { include: deviceId } }, { term: { 'include.keyword': deviceId } }],
        minimum_should_match: 1,
      },
    });
  }

  if (hasValue(filters.search)) {
    const search = String(filters.search).trim();
    must.push({
      bool: {
        should: [
          { term: { policy_name: search } },
          { term: { 'policy_name.keyword': search } },
          { match_phrase_prefix: { policy_name: search } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (!filter.length && !must.length) return { match_all: {} };
  return {
    bool: {
      ...(filter.length ? { filter } : {}),
      ...(must.length ? { must } : {}),
    },
  };
}

function buildDeviceListMust(filters = {}, session = {}) {
  const must = [...buildSessionFilters(session), assignedMustClause()];

  if (session.isSuperAdmin && hasValue(filters.orgId)) {
    must.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }
  if (session.isSuperAdmin && hasValue(filters.branchId)) {
    must.push({ term: { 'branchId.keyword': String(filters.branchId).trim() } });
  }
  if (hasValue(filters.model)) {
    const model = String(filters.model).trim();
    must.push({
      bool: {
        should: [{ term: { 'model.keyword': model } }, { term: { model } }],
        minimum_should_match: 1,
      },
    });
  }

  const search = String(filters.search || '').trim();
  if (search) {
    must.push({
      bool: {
        should: [
          { term: { 'sysname.keyword': { value: search, boost: 20 } } },
          { match_phrase_prefix: { sysname: { query: search, boost: 8 } } },
          {
            multi_match: {
              query: search,
              fields: ['sysname', 'model', 'tags'],
              fuzziness: 'AUTO',
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }

  const tags = String(filters.tags || '').trim();
  if (tags && !hasValue(session.tags)) {
    const tokens = tags.split(',').map((item) => item.trim()).filter(Boolean);
    if (tokens.length === 1) {
      must.push({
        wildcard: { 'tags.keyword': `*${escapeWildcard(tokens[0])}*` },
      });
    } else if (tokens.length > 1) {
      must.push({
        bool: {
          should: tokens.map((token) => ({
            wildcard: { 'tags.keyword': `*${escapeWildcard(token)}*` },
          })),
          minimum_should_match: 1,
        },
      });
    }
  }

  return must;
}

function normalizeLteRadio(radio = {}) {
  if (radio && typeof radio === 'object' && !Array.isArray(radio)) {
    return {
      status: normalizeBool(radio.status),
      dbm: radio.dbm ?? '',
      lostp: radio.lostp ?? '',
      latency: radio.latency ?? '',
    };
  }
  return {
    status: 0,
    dbm: '',
    lostp: '',
    latency: '',
  };
}

function normalizePolicyPayload(payload = {}, session = {}, { preserveCreated } = {}) {
  const now = nowEpoch();
  const scope = stampScope(payload, session);
  const policyName = String(payload.policy_name || '').trim();
  if (!policyName) fail('Policy name is required', 400);

  return {
    policy_name: policyName,
    include: asIdList(payload.include),
    orgId: scope.orgId,
    branchId: scope.branchId,
    dev_status: {
      status: normalizeBool(payload.dev_status?.status),
      olevel: payload.dev_status?.olevel || '',
      slevel: payload.dev_status?.slevel || '',
    },
    link_status: {
      status: normalizeBool(payload.link_status?.status),
      olevel: payload.link_status?.olevel || '',
      slevel: payload.link_status?.slevel || '',
    },
    dev_health: {
      status: normalizeBool(payload.dev_health?.status),
      olevel: payload.dev_health?.olevel || '',
      slevel: payload.dev_health?.slevel || '',
      cpu: payload.dev_health?.cpu ?? '',
      mem: payload.dev_health?.mem ?? '',
      wan1: payload.dev_health?.wan1 ?? '',
      wan2: payload.dev_health?.wan2 ?? '',
      wan3: payload.dev_health?.wan3 ?? '',
      wan4: payload.dev_health?.wan4 ?? '',
    },
    lte_health: {
      status: normalizeBool(payload.lte_health?.status),
      olevel: payload.lte_health?.olevel || '',
      slevel: payload.lte_health?.slevel || '',
      LTE1: normalizeLteRadio(payload.lte_health?.LTE1),
      LTE2: normalizeLteRadio(payload.lte_health?.LTE2),
    },
    email: payload.email || '',
    enemail: normalizeBool(payload.enemail),
    apiURL: payload.apiURL || '',
    enApiURL: normalizeBool(payload.enApiURL),
    enpolicy: normalizeBool(payload.enpolicy ?? 1),
    datecreated: preserveCreated && Number(payload.datecreated) ? Number(payload.datecreated) : now,
    lu: now,
  };
}

async function assertUniquePolicyName(policyName, { excludeId, orgId } = {}) {
  const name = String(policyName || '').trim();
  if (!name) return;

  const must = [
    {
      bool: {
        should: [{ term: { policy_name: name } }, { term: { 'policy_name.keyword': name } }],
        minimum_should_match: 1,
      },
    },
  ];
  const filter = [];
  if (hasValue(orgId)) {
    filter.push({
      bool: {
        should: [
          { term: { 'orgId.keyword': String(orgId).trim() } },
          { bool: { must_not: [{ exists: { field: 'orgId' } }] } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  const query = {
    bool: {
      must,
      ...(filter.length ? { filter } : {}),
      ...(excludeId ? { must_not: [{ ids: { values: [excludeId] } }] } : {}),
    },
  };

  try {
    const { body } = await client.search({
      index: INDICES.ALARM_CONFIG,
      body: { size: 1, _source: false, query },
    });
    if ((body?.hits?.hits || []).length) {
      fail(`Alarm policy name already exists: ${name}`, 409);
    }
  } catch (err) {
    if (err.status) throw err;
    if (isIndexMissing(err)) return;
    throw err;
  }
}

async function assertIncludedDevicesInScope(include, session = {}) {
  const ids = asIdList(include);
  if (!ids.length) return [];

  let hits = [];
  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: ids.length,
        query: {
          bool: {
            filter: [...buildSessionFilters(session), { ids: { values: ids } }],
          },
        },
        _source: ['orgId', 'branchId', 'sysname'],
      },
    });
    hits = (body?.hits?.hits || []).filter((hit) => isAssigned(hit._source || {}));
  } catch (err) {
    if (isIndexMissing(err)) fail('One or more included devices are invalid or out of scope', 400);
    throw err;
  }

  if (hits.length !== ids.length) {
    fail('One or more included devices are invalid or out of scope', 400);
  }
  return hits;
}

async function fetchOrgDeviceIds(orgId) {
  const scopedOrgId = String(orgId || '').trim();
  if (!scopedOrgId) return [];

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: MAX_SELECT_ALL_IDS,
        _source: false,
        query: {
          bool: {
            filter: [{ term: { 'orgId.keyword': scopedOrgId } }, assignedMustClause()],
          },
        },
      },
    });
    return (body?.hits?.hits || []).map((hit) => String(hit._id || '')).filter(Boolean);
  } catch (err) {
    if (isIndexMissing(err)) return [];
    throw err;
  }
}

async function applyResolvedScope(doc, payload, session) {
  const deviceHits = await assertIncludedDevicesInScope(doc.include, session);
  const scope = resolveScopeFromDevices(
    { orgId: doc.orgId, branchId: doc.branchId },
    deviceHits,
    payload,
    session,
  );
  doc.orgId = scope.orgId;
  doc.branchId = scope.branchId;
  return doc;
}

export async function listAlarmPolicies(filters = {}, session = {}) {
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const orgDeviceIds =
    !session.isSuperAdmin && hasValue(session.orgId)
      ? await fetchOrgDeviceIds(session.orgId)
      : [];

  try {
    const { body } = await client.search({
      index: INDICES.ALARM_CONFIG,
      body: {
        query: buildPolicyListQuery(filters, session, orgDeviceIds),
        sort: [{ lu: { order: 'desc', unmapped_type: 'long' } }],
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
      },
    });

    return {
      policies: (body?.hits?.hits || []).map(mapPolicyHit),
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { policies: [], total: 0, page, pageSize };
    }
    throw err;
  }
}

export async function getAlarmPolicyById(id, session = {}) {
  const docId = String(id || '').trim();
  if (!docId) fail('Alarm policy id is required', 400);

  try {
    const { body } = await client.get({
      index: INDICES.ALARM_CONFIG,
      id: docId,
    });
    if (!body?.found) notFoundError();

    const policy = mapPolicyHit(body);
    if (!policyOrgMatches(policy, session)) notFoundError();
    return policy;
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) notFoundError();
    throw err;
  }
}

export async function createAlarmPolicy(payload = {}, session = {}) {
  assertCanManageAlarmPolicies(session);
  const doc = normalizePolicyPayload(payload, session);
  await applyResolvedScope(doc, payload, session);
  await assertUniquePolicyName(doc.policy_name, { orgId: doc.orgId });

  const id = randomUUID();
  const { body } = await client.index({
    index: INDICES.ALARM_CONFIG,
    id,
    body: doc,
    refresh: true,
  });

  return { id: body?._id || id, ...doc };
}

export async function updateAlarmPolicy(id, payload = {}, session = {}) {
  assertCanManageAlarmPolicies(session);
  const existing = await getAlarmPolicyById(id, session);
  assertCanWritePolicy(existing, session);

  const doc = normalizePolicyPayload(
    { ...existing, ...payload, datecreated: existing.datecreated },
    session,
    { preserveCreated: true },
  );
  if (!session.isSuperAdmin) {
    doc.orgId = existing.orgId || doc.orgId;
    doc.branchId = existing.branchId || doc.branchId;
  }

  await applyResolvedScope(doc, payload, session);
  await assertUniquePolicyName(doc.policy_name, { excludeId: String(id).trim(), orgId: doc.orgId });

  try {
    await client.update({
      index: INDICES.ALARM_CONFIG,
      id: String(id).trim(),
      body: { doc },
      refresh: true,
    });
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) notFoundError();
    throw err;
  }

  return { id: String(id).trim(), ...doc };
}

export async function deleteAlarmPolicy(id, session = {}) {
  assertCanManageAlarmPolicies(session);
  const existing = await getAlarmPolicyById(id, session);
  assertCanWritePolicy(existing, session);

  try {
    await client.delete({
      index: INDICES.ALARM_CONFIG,
      id: String(id).trim(),
      refresh: true,
    });
    return { id: String(id).trim() };
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) notFoundError();
    throw err;
  }
}

function mapDeviceHit(hit) {
  const src = hit._source || {};
  return {
    id: hit._id,
    sysname: src.sysname || '',
    model: src.model || '',
    orgId: src.orgId || '',
    branchId: src.branchId || '',
    tags: src.tags || '',
  };
}

async function fetchDevicesByIds(ids, session = {}) {
  const unique = asIdList(ids).slice(0, 500);
  if (!unique.length) return [];

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: unique.length,
        query: {
          bool: {
            filter: [...buildSessionFilters(session), { ids: { values: unique } }],
          },
        },
        _source: POLICY_DEVICE_SOURCE,
      },
    });
    return (body?.hits?.hits || [])
      .filter((hit) => isAssigned(hit._source || {}))
      .map(mapDeviceHit);
  } catch (err) {
    if (isIndexMissing(err)) return [];
    throw err;
  }
}

/** Assigned devices in session scope for the policy include picker. */
export async function listPolicyDevices(filters = {}, session = {}) {
  const { page, pageSize } = clampPage(filters.page, filters.pageSize);
  const must = buildDeviceListMust(filters, session);
  const selectedIds = asIdList(filters.ids);

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
        sort: [{ 'sysname.keyword': { order: 'asc', unmapped_type: 'keyword' } }],
        _source: POLICY_DEVICE_SOURCE,
        query: { bool: { must } },
        aggs: {
          models: {
            terms: { field: 'model.keyword', size: 100, missing: '' },
          },
        },
      },
    });

    const devices = (body?.hits?.hits || [])
      .filter((hit) => isAssigned(hit._source || {}))
      .map(mapDeviceHit);

    const models = (body?.aggregations?.models?.buckets || [])
      .map((bucket) => String(bucket.key || '').trim())
      .filter(Boolean);

    const selected = selectedIds.length ? await fetchDevicesByIds(selectedIds, session) : [];

    return {
      devices,
      selected,
      models,
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { devices: [], selected: [], models: [], total: 0, page, pageSize };
    }
    throw err;
  }
}

/** IDs only for “select all matching” — does not load full device documents. */
export async function listPolicyDeviceIds(filters = {}, session = {}) {
  const must = buildDeviceListMust(filters, session);

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        from: 0,
        size: MAX_SELECT_ALL_IDS,
        track_total_hits: true,
        _source: false,
        query: { bool: { must } },
      },
    });

    const ids = (body?.hits?.hits || []).map((hit) => String(hit._id || '')).filter(Boolean);
    const total = hitTotal(body);
    return {
      ids,
      total,
      truncated: total > ids.length,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { ids: [], total: 0, truncated: false };
    }
    throw err;
  }
}
