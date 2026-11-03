import { v4 as uuidv4 } from 'uuid';
import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

/** Allowed writable org fields (matches current `org` index docs). */
const ORG_FIELDS = Object.freeze([
  'org',
  'org_name',
  'address',
  'phone',
  'email',
  'web',
  'logo',
]);

function hasValue(value) {
  return value != null && String(value).trim() !== '';
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function hitTotal(body) {
  const total = body?.hits?.total;
  if (typeof total === 'number') return total;
  return Number(total?.value) || 0;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

function isNotFound(err) {
  return (
    err?.meta?.statusCode === 404 ||
    err?.meta?.body?.result === 'not_found' ||
    err?.meta?.body?.found === false
  );
}

function sanitizeOrgInput(input = {}) {
  const out = {};
  for (const key of ORG_FIELDS) {
    if (input[key] === undefined) continue;
    out[key] = typeof input[key] === 'string' ? input[key].trim() : input[key];
  }
  return out;
}

function requireOrgLabels(orgData = {}) {
  if (!hasValue(orgData.org_name) && !hasValue(orgData.org)) {
    const err = new Error('Organization name (org_name or org) is required');
    err.status = 400;
    throw err;
  }
}

/**
 * True if another org already uses the same org_name or org code.
 * @param {object} orgData
 * @param {string} [excludeId] — doc id to skip (update)
 */
async function findDuplicateOrg(orgData = {}, excludeId = '') {
  const should = [];
  if (hasValue(orgData.org_name)) {
    should.push({ term: { 'org_name.keyword': String(orgData.org_name).trim() } });
  }
  if (hasValue(orgData.org)) {
    should.push({ term: { 'org.keyword': String(orgData.org).trim() } });
  }
  if (!should.length) return null;

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: 5,
        query: {
          bool: {
            should,
            minimum_should_match: 1,
            ...(hasValue(excludeId)
              ? { must_not: [{ ids: { values: [String(excludeId)] } }] }
              : {}),
          },
        },
        _source: ['org', 'org_name'],
      },
    });

    const hit = body.hits?.hits?.[0];
    return hit ? { id: hit._id, ...(hit._source || {}) } : null;
  } catch (err) {
    if (isIndexMissing(err)) return null;
    throw err;
  }
}

async function safeCount(index, query) {
  try {
    const { body } = await client.count({ index, body: { query } });
    return Number(body?.count) || 0;
  } catch (err) {
    if (isIndexMissing(err)) return 0;
    throw err;
  }
}

/** Fetch one org document from the org index (management form). */
export async function getOrganizationDoc(orgId) {
  const id = String(orgId || '').trim();
  if (!id) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  try {
    const { body } = await client.get({
      index: INDICES.ORGANIZATIONS,
      id,
    });
    if (!body?.found) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }
    return { id: body._id, ...(body._source || {}) };
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) {
      const notFound = new Error('Organization not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

/**
 * Create a new organization in INDICES.ORGANIZATIONS (`org`).
 * Duplicate check on org_name / org (.keyword).
 */
export async function createOrganizationQuery(rawInput = {}) {
  const orgData = sanitizeOrgInput(rawInput);
  requireOrgLabels(orgData);

  const dup = await findDuplicateOrg(orgData);
  if (dup) {
    const err = new Error('Organization with this name or code already exists');
    err.status = 409;
    throw err;
  }

  const now = nowEpoch();
  const doc = {
    org: orgData.org || orgData.org_name,
    org_name: orgData.org_name || orgData.org,
    address: orgData.address || '',
    phone: orgData.phone || '',
    email: orgData.email || '',
    web: orgData.web || '',
    logo: orgData.logo || '',
    datecreated: Number(rawInput.datecreated) || now,
    lastupdated: now,
  };

  const orgDocId = uuidv4();
  const { body } = await client.index({
    index: INDICES.ORGANIZATIONS,
    id: orgDocId,
    body: doc,
    refresh: true,
  });

  return { id: body?._id || orgDocId, ...doc };
}

/**
 * Partial update of an organization document.
 */
export async function updateOrganizationQuery(orgId, rawInput = {}) {
  const id = String(orgId || '').trim();
  if (!id) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  await getOrganizationDoc(id);

  const orgData = sanitizeOrgInput(rawInput);
  if (!Object.keys(orgData).length) {
    const err = new Error('No valid organization fields to update');
    err.status = 400;
    throw err;
  }

  if (hasValue(orgData.org_name) || hasValue(orgData.org)) {
    const dup = await findDuplicateOrg(orgData, id);
    if (dup) {
      const err = new Error('Organization with this name or code already exists');
      err.status = 409;
      throw err;
    }
  }

  const doc = {
    ...orgData,
    lastupdated: nowEpoch(),
  };

  await client.update({
    index: INDICES.ORGANIZATIONS,
    id,
    body: { doc },
    refresh: true,
  });

  return getOrganizationDoc(id);
}

/**
 * Delete an organization document.
 * Does not cascade-delete branches/devices — caller should check getOrgCounts first.
 */
export async function deleteOrganizationQuery(orgId) {
  const id = String(orgId || '').trim();
  if (!id) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  try {
    await client.delete({
      index: INDICES.ORGANIZATIONS,
      id,
      refresh: true,
    });
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) {
      return { id };
    }
    throw err;
  }

  return { id };
}

/**
 * Related counts for org management (delete guard / summary).
 * Branches / devices linked by orgId.keyword.
 */
export async function getOrgCounts(orgId) {
  const id = String(orgId || '').trim();
  if (!id) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  const byOrgId = { term: { 'orgId.keyword': id } };

  const [branches, devices] = await Promise.all([
    safeCount(INDICES.BRANCHES, byOrgId),
    safeCount(INDICES.DEVICES, byOrgId),
  ]);

  return {
    orgId: id,
    branches,
    devices,
    totalLinked: branches + devices,
  };
}

/**
 * List raw org documents for management CRUD UI (from org index).
 * Optional search on org / org_name.
 */
export async function listOrganizationDocs(filters = {}) {
  const must = [];
  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['org_name', 'org', 'email', 'address', 'phone', 'web'],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: Math.min(Math.max(Number(filters.pageSize) || 500, 1), 1000),
        from: Math.max(((Number(filters.page) || 1) - 1) * (Number(filters.pageSize) || 500), 0),
        query,
        sort: [{ 'org_name.keyword': { order: 'asc', unmapped_type: 'keyword' } }],
        track_total_hits: true,
      },
    });

    const organizations = (body.hits?.hits || []).map((h) => ({
      id: h._id,
      ...(h._source || {}),
    }));

    return {
      organizations,
      total: hitTotal(body),
      page: Number(filters.page) || 1,
      pageSize: Number(filters.pageSize) || 500,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { organizations: [], total: 0, page: 1, pageSize: Number(filters.pageSize) || 500 };
    }
    throw err;
  }
}
