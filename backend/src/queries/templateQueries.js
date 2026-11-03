import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { buildSessionFilters } from '../config/deviceStatusConfig.js';
import { fetchOrgNamesByIds } from './orgNameLookup.js';

/** Writable / returned template fields (`template` index). */
const TEMPLATE_FIELDS = Object.freeze([
  'temp_name',
  'temp_type',
  'model',
  'desc',
  'orgId',
  'temp_file',
  'is_master',
  'parent_templates',
  'datecreated',
  'lastupdated',
]);

const SORTABLE_FIELDS = Object.freeze(['datecreated', 'temp_name', 'temp_type', 'model']);

function hasValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
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

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function notFoundError(message = 'Template not found') {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function statusError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Super / Org / Branch Admin only — viewers are read-only. */
export function assertCanManageTemplates(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '99' || role === '7' || role === '1') return;
  throw statusError('You do not have permission to manage templates', 403);
}

function sanitizeTemplateInput(input = {}) {
  const out = {};
  for (const key of TEMPLATE_FIELDS) {
    if (input[key] === undefined) continue;
    out[key] = typeof input[key] === 'string' ? input[key].trim() : input[key];
  }
  return out;
}

/** Org dropdown for template UI — super admin sees all orgs; others see own org only. */
function buildTemplateOrgScopeQuery(session = {}) {
  if (session.isSuperAdmin) return { match_all: {} };

  const orgId = String(session.orgId || '').trim();
  if (!orgId) return { match_none: {} };

  return { ids: { values: [orgId] } };
}

function buildTemplateSessionFilters(session = {}) {
  const filter = [];
  const orgId = String(session.orgId || '').trim();
  if (orgId) {
    filter.push({ term: { 'orgId.keyword': orgId } });
  }
  return filter;
}

function buildTemplateMust(filters = {}, session = {}) {
  const filter = [...buildTemplateSessionFilters(session)];
  const must = [];

  // Super admin may narrow org via query; session already scoped for org/branch admins.
  if (session.isSuperAdmin && hasValue(filters.orgId)) {
    filter.push({ term: { 'orgId.keyword': String(filters.orgId).trim() } });
  }

  if (hasValue(filters.model)) {
    filter.push({ term: { 'model.keyword': String(filters.model).trim() } });
  }

  if (hasValue(filters.type)) {
    filter.push({ term: { 'temp_type.keyword': String(filters.type).trim() } });
  }

  if (hasValue(filters.search)) {
    must.push({
      multi_match: {
        query: String(filters.search).trim(),
        fields: ['temp_name', 'temp_type', 'model', 'desc'],
        fuzziness: 'AUTO',
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

function buildTemplateSort(filters = {}) {
  const sortBy = SORTABLE_FIELDS.includes(String(filters.sortBy || '').trim())
    ? String(filters.sortBy).trim()
    : 'datecreated';
  const order = String(filters.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return [{ [sortBy]: { order, unmapped_type: 'long' } }];
}

function mapTemplateHit(hit) {
  return {
    id: hit?._id,
    ...(hit?._source || {}),
  };
}

async function assertTemplateAccess(id, session = {}) {
  const template = await getTemplateById(id, session);
  return template;
}

/**
 * Organizations for template filters (from `org` index, session-scoped).
 */
export async function getTemplateOrganizations(session = {}) {
  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        query: buildTemplateOrgScopeQuery(session),
        size: 1000,
        sort: [{ 'org_name.keyword': { order: 'asc', unmapped_type: 'keyword' } }],
        _source: ['org', 'org_name'],
      },
    });

    return (body?.hits?.hits || []).map((hit) => ({
      id: hit._id,
      name: hit._source?.org_name || hit._source?.org || hit._id,
    }));
  } catch (err) {
    if (isIndexMissing(err)) return [];
    throw err;
  }
}

/**
 * Distinct device models for template creation (from `devices`, optional org filter).
 */
export async function getTemplateModels(orgId, session = {}) {
  const filter = [...buildSessionFilters(session)];

  if (session.isSuperAdmin && hasValue(orgId)) {
    filter.push({ term: { 'orgId.keyword': String(orgId).trim() } });
  }

  const query = filter.length ? { bool: { filter } } : { match_all: {} };

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: 0,
        query,
        aggs: {
          models: {
            terms: { field: 'model.keyword', size: 1000, order: { _key: 'asc' } },
          },
        },
      },
    });

    return (body?.aggregations?.models?.buckets || []).map((b) => b.key).filter(Boolean);
  } catch (err) {
    if (!isIndexMissing(err)) throw err;
  }

  // Fallback: legacy product field on ahtrans
  try {
    const { body } = await client.search({
      index: INDICES.DEVICE_DETAILS,
      body: {
        size: 0,
        query: {
          bool: {
            must: [{ match_phrase: { f: 'DEVICE_PRODUCT' } }],
          },
        },
        aggs: {
          models: {
            terms: { field: 'v.keyword', size: 1000, order: { _key: 'asc' } },
          },
        },
      },
    });

    return (body?.aggregations?.models?.buckets || []).map((b) => b.key).filter(Boolean);
  } catch (fallbackErr) {
    if (isIndexMissing(fallbackErr)) return [];
    throw fallbackErr;
  }
}

/**
 * List templates with filters + pagination.
 * Filters: orgId (SA), model, type, search, sortBy, sortOrder, page, pageSize.
 */
export async function listTemplates(filters = {}, session = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 50, 1), 500);

  try {
    const { body } = await client.search({
      index: INDICES.TEMPLATES,
      body: {
        query: buildTemplateMust(filters, session),
        sort: buildTemplateSort(filters),
        from: Math.max((page - 1) * pageSize, 0),
        size: pageSize,
        track_total_hits: true,
      },
    });

    const templates = (body?.hits?.hits || []).map(mapTemplateHit);
    const orgIds = templates.map((row) => row.orgId).filter(Boolean);
    const orgNamesById = await fetchOrgNamesByIds(orgIds);

    return {
      templates: templates.map((row) => {
        const orgId = String(row.orgId || '').trim();
        const orgName = (orgId && orgNamesById.get(orgId)) || '';
        return {
          ...row,
          org: orgName || row.org || '',
          orgName: orgName || row.orgName || '',
        };
      }),
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { templates: [], total: 0, page, pageSize };
    }
    throw err;
  }
}

/** Fetch one template by id (session org scope enforced). */
export async function getTemplateById(id, session = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    const err = new Error('Template id is required');
    err.status = 400;
    throw err;
  }

  try {
    const { body } = await client.get({
      index: INDICES.TEMPLATES,
      id: docId,
    });

    if (!body?.found) throw notFoundError();

    const template = mapTemplateHit(body);

    if (!session.isSuperAdmin) {
      const scopedOrg = String(session.orgId || '').trim();
      const templateOrg = String(template.orgId || '').trim();
      if (scopedOrg && templateOrg && scopedOrg !== templateOrg) {
        throw notFoundError();
      }
    }

    const orgId = String(template.orgId || '').trim();
    if (orgId) {
      const orgNamesById = await fetchOrgNamesByIds([orgId]);
      const orgName = orgNamesById.get(orgId) || '';
      if (orgName) {
        template.org = orgName;
        template.orgName = orgName;
      }
    }

    return template;
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) throw notFoundError();
    throw err;
  }
}

/** Templates for a given org + model (newest first). */
export async function listTemplatesByOrgAndModel(orgId, model, session = {}) {
  if (!hasValue(orgId) || !hasValue(model)) {
    const err = new Error('Organization id and model are required');
    err.status = 400;
    throw err;
  }

  const filters = {
    orgId: String(orgId).trim(),
    model: String(model).trim(),
    sortBy: 'datecreated',
    sortOrder: 'desc',
    page: 1,
    pageSize: 500,
  };

  const { templates } = await listTemplates(filters, session);
  return templates;
}

/** Insert a template document. */
export async function createTemplate(rawInput = {}, session = {}) {
  const input = sanitizeTemplateInput(rawInput);

  if (!hasValue(input.temp_name)) {
    const err = new Error('Template name (temp_name) is required');
    err.status = 400;
    throw err;
  }

  if (session.isSuperAdmin) {
    if (!hasValue(input.orgId)) {
      const err = new Error('Organization (orgId) is required');
      err.status = 400;
      throw err;
    }
  } else {
    const scopedOrg = String(session.orgId || '').trim();
    if (!scopedOrg) {
      const err = new Error('Organization scope is required');
      err.status = 403;
      throw err;
    }
    input.orgId = scopedOrg;
  }

  const now = nowEpoch();
  const doc = {
    temp_name: input.temp_name,
    temp_type: input.temp_type || '',
    model: input.model || '',
    desc: input.desc || '',
    orgId: input.orgId,
    temp_file: input.temp_file || '',
    is_master: Boolean(input.is_master),
    parent_templates: Array.isArray(input.parent_templates) ? input.parent_templates : [],
    datecreated: Number(input.datecreated) || now,
    lastupdated: now,
  };

  const explicitId = rawInput.id != null ? String(rawInput.id).trim() : '';

  const { body } = await client.index({
    index: INDICES.TEMPLATES,
    ...(explicitId ? { id: explicitId } : {}),
    body: doc,
    refresh: true,
  });

  return { id: body?._id || explicitId, ...doc };
}

/** Partial update by id. */
export async function updateTemplateById(id, rawInput = {}, session = {}) {
  await assertTemplateAccess(id, session);

  const updateData = sanitizeTemplateInput(rawInput);
  delete updateData.datecreated;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  if (!session.isSuperAdmin && updateData.orgId !== undefined) {
    delete updateData.orgId;
  }

  updateData.lastupdated = nowEpoch();

  try {
    const { body } = await client.update({
      index: INDICES.TEMPLATES,
      id: String(id).trim(),
      body: { doc: updateData },
      refresh: true,
    });

    return { id: body?._id || String(id).trim() };
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) throw notFoundError();
    throw err;
  }
}

/** Delete template by id. */
export async function deleteTemplateById(id, session = {}) {
  await assertTemplateAccess(id, session);

  try {
    await client.delete({
      index: INDICES.TEMPLATES,
      id: String(id).trim(),
      refresh: true,
    });
    return { success: true };
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) throw notFoundError();
    throw err;
  }
}
