import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { client } from '../../opensearch/client.js';
import { INDICES, USER_ROLES, USER_STATUS } from '../config/databaseConfig.js';
import { assertPasswordPolicy } from '../utils/passwordPolicy.js';

/** Writable account fields (matches `access` / USERS index + auth/userQueries). */
const ACCOUNT_FIELDS = Object.freeze([
  'email',
  'pass',
  'firstname',
  'lastname',
  'phone',
  'role',
  'orgId',
  'branchId',
  'tags',
  'groupKey',
  'organization',
  'orgName',
  'active',
]);

const BCRYPT_ROUNDS = 10;

const SAFE_SOURCE = Object.freeze([
  'email',
  'firstname',
  'firstName',
  'lastname',
  'lastName',
  'phone',
  'role',
  'orgId',
  'branchId',
  'tags',
  'groupKey',
  'organization',
  'orgName',
  'active',
  'datecreated',
  'lastupdated',
  'tokenVersion',
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

/**
 * Match term queries against long / keyword / plain string storage variants.
 * Prefer numeric match for long-mapped fields (role, active).
 */
function flexibleTerm(field, value, { numeric = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let normalized = raw;
  if (numeric && field === 'active') {
    const lower = raw.toLowerCase();
    if (['1', 'true', 'yes', 'active', 'on'].includes(lower)) normalized = '1';
    else if (['0', 'false', 'no', 'inactive', 'off'].includes(lower)) normalized = '0';
  }

  const should = [];
  const n = Number(normalized);
  const isNumeric = Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(normalized);

  if (numeric || isNumeric) {
    if (!isNumeric) return null;
    // OpenSearch `long` fields must receive a number, not a string
    should.push({ term: { [field]: n } });
  } else {
    should.push({ term: { [field]: normalized } });
    should.push({ term: { [`${field}.keyword`]: normalized } });
  }

  return { bool: { should, minimum_should_match: 1 } };
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

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

function stripPassword(doc = {}) {
  const { pass, password, ...rest } = doc;
  return rest;
}

function mapAccountHit(hit) {
  const src = hit._source || {};
  return stripPassword({
    id: hit._id,
    email: src.email || '',
    firstname: src.firstname || src.firstName || '',
    lastname: src.lastname || src.lastName || '',
    phone: src.phone || '',
    role: src.role != null ? String(src.role) : '',
    orgId: src.orgId || '',
    branchId: src.branchId || '',
    tags: src.tags || '',
    groupKey: src.groupKey || '',
    organization: src.organization || src.orgName || '',
    orgName: src.orgName || src.organization || '',
    active: src.active != null ? String(src.active) : USER_STATUS.ACTIVE,
    datecreated: src.datecreated,
    lastupdated: src.lastupdated,
    tokenVersion: src.tokenVersion,
  });
}

function sanitizeAccountInput(input = {}, { allowPassword = true } = {}) {
  const out = {};
  const raw = { ...input };

  // Normalize alternate keys from UI / legacy payloads
  if (raw.firstName != null && raw.firstname === undefined) raw.firstname = raw.firstName;
  if (raw.lastName != null && raw.lastname === undefined) raw.lastname = raw.lastName;
  if (raw.password != null && raw.pass === undefined) raw.pass = raw.password;
  if (raw.org != null && raw.organization === undefined) raw.organization = raw.org;

  for (const key of ACCOUNT_FIELDS) {
    if (raw[key] === undefined) continue;
    if (key === 'pass' && !allowPassword) continue;
    if (key === 'email' && raw[key] != null) {
      out.email = normalizeEmail(raw[key]);
      continue;
    }
    if (key === 'role' || key === 'active') {
      out[key] = raw[key] != null ? String(raw[key]).trim() : raw[key];
      continue;
    }
    out[key] = typeof raw[key] === 'string' ? raw[key].trim() : raw[key];
  }

  return out;
}

function assertValidRole(role) {
  if (!hasValue(role)) return;
  const allowed = new Set(Object.values(USER_ROLES));
  if (!allowed.has(String(role).trim())) {
    const err = new Error(
      `Invalid role. Allowed: ${[...allowed].join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

function assertValidActive(active) {
  if (active === undefined) return;
  const allowed = new Set(Object.values(USER_STATUS));
  if (!allowed.has(String(active).trim())) {
    const err = new Error(
      `Invalid active status. Allowed: ${[...allowed].join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

async function hashPasswordIfNeeded(pass) {
  if (!hasValue(pass)) return '';
  const value = String(pass);
  if (isBcryptHash(value)) {
    // Normalize bcrypt $2y$ prefix for Node bcrypt
    return value.startsWith('$2y$') ? value.replace(/^\$2y\$/, '$2b$') : value;
  }
  return bcrypt.hash(value, BCRYPT_ROUNDS);
}

async function findAccountByEmail(email, excludeId = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  try {
    const { body } = await client.search({
      index: INDICES.USERS,
      body: {
        size: 1,
        query: {
          bool: {
            filter: [{ term: { 'email.keyword': normalized } }],
            ...(hasValue(excludeId)
              ? { must_not: [{ ids: { values: [String(excludeId)] } }] }
              : {}),
          },
        },
        _source: ['email'],
      },
    });
    const hit = body.hits?.hits?.[0];
    return hit ? { id: hit._id, email: hit._source?.email } : null;
  } catch (err) {
    if (isIndexMissing(err)) return null;
    throw err;
  }
}

/** Fetch one account (password never returned). */
export async function getAccountDoc(accountId) {
  const id = String(accountId || '').trim();
  if (!id) {
    const err = new Error('Account id is required');
    err.status = 400;
    throw err;
  }

  try {
    const { body } = await client.get({
      index: INDICES.USERS,
      id,
      _source: [...SAFE_SOURCE],
    });
    if (!body?.found) {
      const err = new Error('Account not found');
      err.status = 404;
      throw err;
    }
    return mapAccountHit({ _id: body._id, _source: body._source });
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) {
      const notFound = new Error('Account not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

/**
 * List accounts for management UI.
 * Filters: orgId, branchId, role, active, search (email / name / phone).
 */
export async function listAccountDocs(filters = {}) {
  const must = [];

  if (hasValue(filters.orgId)) {
    const clause = flexibleTerm('orgId', filters.orgId);
    if (clause) must.push(clause);
  }
  if (hasValue(filters.branchId)) {
    const clause = flexibleTerm('branchId', filters.branchId);
    if (clause) must.push(clause);
  }
  if (hasValue(filters.role)) {
    const clause = flexibleTerm('role', filters.role, { numeric: true });
    if (clause) must.push(clause);
  }
  if (hasValue(filters.active)) {
    const clause = flexibleTerm('active', filters.active, { numeric: true });
    if (clause) must.push(clause);
  }
  if (hasValue(filters.search)) {
    const q = String(filters.search).trim();
    must.push({
      multi_match: {
        query: q,
        fields: ['email', 'firstname', 'lastname', 'phone', 'organization', 'orgName', 'tags'],
        fuzziness: 'AUTO',
      },
    });
  }

  const query = must.length ? { bool: { must } } : { match_all: {} };
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 100, 1), 1000);

  try {
    const { body } = await client.search({
      index: INDICES.USERS,
      body: {
        size: pageSize,
        from: Math.max((page - 1) * pageSize, 0),
        query,
        sort: [{ 'email.keyword': { order: 'asc', unmapped_type: 'keyword' } }],
        _source: [...SAFE_SOURCE],
        track_total_hits: true,
      },
    });

    const accounts = (body.hits?.hits || []).map(mapAccountHit);

    return {
      accounts,
      total: hitTotal(body),
      page,
      pageSize,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { accounts: [], total: 0, page, pageSize };
    }
    throw err;
  }
}

/**
 * Create account in INDICES.USERS (`access`).
 * Hashes `pass` / `password` when not already a bcrypt hash.
 */
export async function createAccountQuery(rawInput = {}) {
  const data = sanitizeAccountInput(rawInput, { allowPassword: true });

  if (!hasValue(data.email)) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }
  if (!hasValue(data.pass)) {
    const err = new Error('Password is required');
    err.status = 400;
    throw err;
  }
  assertPasswordPolicy(data.pass, { email: data.email });

  assertValidRole(data.role);
  assertValidActive(data.active);

  const dup = await findAccountByEmail(data.email);
  if (dup) {
    const err = new Error('An account with this email already exists');
    err.status = 409;
    throw err;
  }

  const now = nowEpoch();
  const hashed = await hashPasswordIfNeeded(data.pass);

  const doc = {
    email: data.email,
    pass: hashed,
    firstname: data.firstname || '',
    lastname: data.lastname || '',
    phone: data.phone || '',
    role: hasValue(data.role) ? String(data.role) : USER_ROLES.VIEWER,
    orgId: data.orgId || '',
    branchId: data.branchId || '',
    tags: data.tags || '',
    groupKey: data.groupKey || '',
    organization: data.organization || data.orgName || '',
    orgName: data.orgName || data.organization || '',
    active: hasValue(data.active) ? String(data.active) : USER_STATUS.ACTIVE,
    datecreated: Number(rawInput.datecreated) || now,
    lastupdated: now,
    tokenVersion: 0,
  };

  const accountId = uuidv4();
  const { body } = await client.index({
    index: INDICES.USERS,
    id: accountId,
    body: doc,
    refresh: true,
  });

  return getAccountDoc(body?._id || accountId);
}

/**
 * Partial update. Password optional — hashed when provided.
 * Does not return password.
 */
export async function updateAccountQuery(accountId, rawInput = {}) {
  const id = String(accountId || '').trim();
  if (!id) {
    const err = new Error('Account id is required');
    err.status = 400;
    throw err;
  }

  await getAccountDoc(id);

  const data = sanitizeAccountInput(rawInput, { allowPassword: true });
  if (!Object.keys(data).length) {
    const err = new Error('No valid account fields to update');
    err.status = 400;
    throw err;
  }

  if (hasValue(data.email)) {
    const dup = await findAccountByEmail(data.email, id);
    if (dup) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }
  }

  assertValidRole(data.role);
  assertValidActive(data.active);

  const doc = { ...data, lastupdated: nowEpoch() };
  if (hasValue(doc.pass)) {
    if (!isBcryptHash(doc.pass)) {
      const emailForPolicy = doc.email || (await getAccountDoc(id)).email;
      assertPasswordPolicy(doc.pass, { email: emailForPolicy });
    }
    doc.pass = await hashPasswordIfNeeded(doc.pass);
  } else {
    delete doc.pass;
  }

  await client.update({
    index: INDICES.USERS,
    id,
    body: { doc },
    refresh: true,
  });

  return getAccountDoc(id);
}

/** Delete account document (idempotent if already missing). */
export async function deleteAccountQuery(accountId) {
  const id = String(accountId || '').trim();
  if (!id) {
    const err = new Error('Account id is required');
    err.status = 400;
    throw err;
  }

  try {
    await client.delete({
      index: INDICES.USERS,
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
