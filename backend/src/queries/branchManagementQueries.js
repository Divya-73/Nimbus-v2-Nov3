import { v4 as uuidv4 } from 'uuid';
import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

/**
 * Writable branch fields (matches branch-index docs + BRANCH_SOURCE in branchlistQueries).
 * orgId is set on create / may be updated only by explicit caller policy in the controller.
 */
const BRANCH_FIELDS = Object.freeze([
  'orgId',
  'branch',
  'branch_type',
  'site_id',
  'address',
  'lat',
  'long',
  'phone',
  'email',
  'web',
  'tags',
  'zone',
  'region',
  'outlet_code',
  'ro_code',
  'sales_area',
  'outlet_name',
  'automation_vendor',
  'phase',
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

function sanitizeBranchInput(input = {}, { allowOrgId = true } = {}) {
  const out = {};
  for (const key of BRANCH_FIELDS) {
    if (input[key] === undefined) continue;
    if (key === 'orgId' && !allowOrgId) continue;
    out[key] = typeof input[key] === 'string' ? input[key].trim() : input[key];
  }
  return out;
}

function requireBranchName(branchData = {}) {
  if (!hasValue(branchData.branch)) {
    const err = new Error('Branch name is required');
    err.status = 400;
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

/**
 * True if another branch in the same org already uses this branch name.
 * @param {object} branchData
 * @param {string} [excludeId]
 */
async function findDuplicateBranch(branchData = {}, excludeId = '') {
  if (!hasValue(branchData.branch) || !hasValue(branchData.orgId)) return null;

  try {
    const { body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: 5,
        query: {
          bool: {
            must: [
              { term: { 'orgId.keyword': String(branchData.orgId).trim() } },
              { term: { 'branch.keyword': String(branchData.branch).trim() } },
            ],
            ...(hasValue(excludeId)
              ? { must_not: [{ ids: { values: [String(excludeId)] } }] }
              : {}),
          },
        },
        _source: ['branch', 'orgId'],
      },
    });

    const hit = body.hits?.hits?.[0];
    return hit ? { id: hit._id, ...(hit._source || {}) } : null;
  } catch (err) {
    if (isIndexMissing(err)) return null;
    throw err;
  }
}

/** Ensure orgId exists in the org index. */
async function assertOrgExists(orgId) {
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
      _source: false,
    });
    if (!body?.found) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }
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

/** Fetch one branch document (management form). */
export async function getBranchDoc(branchId) {
  const id = String(branchId || '').trim();
  if (!id) {
    const err = new Error('Branch id is required');
    err.status = 400;
    throw err;
  }

  try {
    const { body } = await client.get({
      index: INDICES.BRANCHES,
      id,
    });
    if (!body?.found) {
      const err = new Error('Branch not found');
      err.status = 404;
      throw err;
    }
    return { id: body._id, ...(body._source || {}) };
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) {
      const notFound = new Error('Branch not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

/**
 * Create a branch in INDICES.BRANCHES (`branch`).
 * Duplicate check: same `branch` name within the same `orgId`.
 */
export async function createBranchQuery(rawInput = {}) {
  const branchData = sanitizeBranchInput(rawInput, { allowOrgId: true });
  requireBranchName(branchData);

  if (!hasValue(branchData.orgId)) {
    const err = new Error('Organization id is required');
    err.status = 400;
    throw err;
  }

  await assertOrgExists(branchData.orgId);

  const dup = await findDuplicateBranch(branchData);
  if (dup) {
    const err = new Error('Branch with this name already exists in the organization');
    err.status = 409;
    throw err;
  }

  const now = nowEpoch();
  const doc = {
    orgId: String(branchData.orgId).trim(),
    branch: branchData.branch,
    branch_type: branchData.branch_type || '',
    site_id: branchData.site_id || '',
    address: branchData.address || '',
    lat: branchData.lat ?? '',
    long: branchData.long ?? '',
    phone: branchData.phone || '',
    email: branchData.email || '',
    web: branchData.web || '',
    tags: branchData.tags || '',
    zone: branchData.zone || '',
    region: branchData.region || '',
    outlet_code: branchData.outlet_code || '',
    ro_code: branchData.ro_code || '',
    sales_area: branchData.sales_area || '',
    outlet_name: branchData.outlet_name || '',
    automation_vendor: branchData.automation_vendor || '',
    phase: branchData.phase || '',
    datecreated: Number(rawInput.datecreated) || now,
    lastupdated: now,
  };

  const branchDocId = uuidv4();
  const { body } = await client.index({
    index: INDICES.BRANCHES,
    id: branchDocId,
    body: doc,
    refresh: true,
  });

  return { id: body?._id || branchDocId, ...doc };
}

/**
 * Partial update of a branch document.
 * Does not change orgId unless `allowOrgIdMove` and orgId is provided (controller decides).
 */
export async function updateBranchQuery(branchId, rawInput = {}, { allowOrgIdMove = false } = {}) {
  const id = String(branchId || '').trim();
  if (!id) {
    const err = new Error('Branch id is required');
    err.status = 400;
    throw err;
  }

  const existing = await getBranchDoc(id);
  const branchData = sanitizeBranchInput(rawInput, { allowOrgId: allowOrgIdMove });

  if (!Object.keys(branchData).length) {
    const err = new Error('No valid branch fields to update');
    err.status = 400;
    throw err;
  }

  if (hasValue(branchData.orgId) && String(branchData.orgId) !== String(existing.orgId || '')) {
    await assertOrgExists(branchData.orgId);
  }

  const nextName = hasValue(branchData.branch) ? branchData.branch : existing.branch;
  const nextOrgId = hasValue(branchData.orgId) ? branchData.orgId : existing.orgId;

  if (hasValue(nextName) && hasValue(nextOrgId)) {
    const dup = await findDuplicateBranch({ branch: nextName, orgId: nextOrgId }, id);
    if (dup) {
      const err = new Error('Branch with this name already exists in the organization');
      err.status = 409;
      throw err;
    }
  }

  const doc = {
    ...branchData,
    lastupdated: nowEpoch(),
  };

  await client.update({
    index: INDICES.BRANCHES,
    id,
    body: { doc },
    refresh: true,
  });

  return getBranchDoc(id);
}

/**
 * Delete a branch document.
 * Does not cascade-delete devices — caller should check getBranchCounts first.
 */
export async function deleteBranchQuery(branchId) {
  const id = String(branchId || '').trim();
  if (!id) {
    const err = new Error('Branch id is required');
    err.status = 400;
    throw err;
  }

  try {
    await client.delete({
      index: INDICES.BRANCHES,
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
 * Related counts for branch management (delete guard / summary).
 * Devices linked by branchId.keyword only (no branchnet / networks).
 */
export async function getBranchCounts(branchId) {
  const id = String(branchId || '').trim();
  if (!id) {
    const err = new Error('Branch id is required');
    err.status = 400;
    throw err;
  }

  const byBranchId = { term: { 'branchId.keyword': id } };
  const devices = await safeCount(INDICES.DEVICES, byBranchId);

  return {
    branchId: id,
    devices,
    totalLinked: devices,
  };
}

/**
 * List raw branch documents for management CRUD UI.
 * Optional filters: search, orgId, zone, region.
 */
export async function listBranchDocs(filters = {}) {
  const must = [];

  if (hasValue(filters.orgId)) {
    must.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }
  if (hasValue(filters.zone)) {
    must.push({ term: { 'zone.keyword': String(filters.zone).trim() } });
  }
  if (hasValue(filters.region)) {
    must.push({ term: { 'region.keyword': String(filters.region).trim() } });
  }
  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: [
          'branch',
          'site_id',
          'zone',
          'region',
          'outlet_name',
          'outlet_code',
          'email',
          'address',
          'phone',
          'tags',
        ],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 100, 1), 1000);

  try {
    const { body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: pageSize,
        from: Math.max((page - 1) * pageSize, 0),
        query,
        sort: [{ 'branch.keyword': { order: 'asc', unmapped_type: 'keyword' } }],
        track_total_hits: true,
      },
    });

    const branches = (body.hits?.hits || []).map((h) => ({
      id: h._id,
      ...(h._source || {}),
    }));

    return {
      branches,
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { branches: [], total: 0, page, pageSize };
    }
    throw err;
  }
}
