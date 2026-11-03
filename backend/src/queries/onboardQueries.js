import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  DEVICE_STATUS,
  DEFAULT_JITTER_SLA,
  DEFAULT_LATENCY_SLA,
  getDeviceStatus,
  INTERFACE_OPERATORS,
  isAssigned,
  listedAssignableIfaces,
  listedDeviceIfaces,
  normalizeInterfaceNameMap,
  normalizeLinkSla,
  normalizeOnboardIfaceMap,
  ONBOARD_IFACE_SLOTS,
  readInterfaceNameMap,
  unassignedMustClause,
} from '../config/deviceStatusConfig.js';
import { listIpv4, normalizeIps, pickGuiIp } from './deviceGuiQueries.js';
import { pushAssignmentUci } from './mqttQueries.js';
import { deleteUnassignedDevice } from './deviceDeleteQueries.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 500;
const SCAN_SIZE = 10000;

const ONBOARD_SOURCE = {
  includes: [
    'sysname',
    'devId',
    'model',
    'version',
    'slu',
    'lastupdated',
    'datecreated',
    'ips',
    'orgId',
    'branchId',
  ],
};

function hasFilterValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'all';
}

function formatDateOnly(value) {
  if (value === undefined || value === null || value === '') return 'N/A';

  const numeric = Number(value);
  const epochSeconds = Number.isFinite(numeric)
    ? numeric > 2_000_000_000_000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric)
    : null;

  const date =
    epochSeconds !== null ? new Date(epochSeconds * 1000) : new Date(String(value));

  if (Number.isNaN(date.getTime())) return 'N/A';

  const pad = (num) => String(num).padStart(2, '0');
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ampm = hours24 >= 12 ? 'PM' : 'AM';

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(hours12)}:${minutes}:${seconds} ${ampm}`;
}

function normalizeVersion(value) {
  const text = String(value || '').trim();
  if (!text) return 'N/A';
  const match = text.match(/\d+(?:\.\d+)+/);
  if (match) return match[0];
  const cleaned = text.replace(/[^0-9.]+/g, '');
  return cleaned || 'N/A';
}

function matchesSearch(src, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const ips = normalizeIps(src.ips).join(' ');
  const hay = [src.sysname, src.model, src.version, src.devId, ips]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

function mapOnboardRow(hit) {
  const src = hit._source || {};
  const ips = normalizeIps(src.ips);
  const ipv4 = listIpv4(ips);

  return {
    id: hit._id,
    hostname: src.sysname || 'Unknown',
    model: src.model || 'N/A',
    version: normalizeVersion(src.version),
    status: DEVICE_STATUS.ONBOARD,
    ips,
    ipv4,
    guiIp: pickGuiIp(ips),
    lastSeen: formatDateOnly(src.slu || src.lastupdated),
    lastUpdated: formatDateOnly(src.lastupdated),
    dateCreated: formatDateOnly(src.datecreated),
  };
}

/**
 * Reported CPEs with no org/branch. Device Performance never includes these;
 * once orgId + branchId are set they appear there as up or down.
 *
 * Session org/branch filters are skipped — onboard docs are unassigned.
 */
export async function getOnboardDevices(filters = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      query: {
        bool: {
          must: [unassignedMustClause()],
          must_not: [{ term: { deleted: true } }],
        },
      },
      sort: [{ slu: { order: 'desc', unmapped_type: 'long' } }],
      from: 0,
      size: SCAN_SIZE,
      track_total_hits: true,
      _source: ONBOARD_SOURCE,
    },
  });

  let hits = (body.hits?.hits || []).filter((h) => {
    const src = h._source || {};
    return getDeviceStatus(src) === DEVICE_STATUS.ONBOARD;
  });

  const models = [
    ...new Set(
      hits
        .map((h) => String(h._source?.model || '').trim())
        .filter((m) => m && m.toUpperCase() !== 'N/A')
    ),
  ].sort((a, b) => a.localeCompare(b));

  if (hasFilterValue(filters.model)) {
    const want = String(filters.model).trim().toLowerCase();
    hits = hits.filter((h) => String(h._source?.model || '').trim().toLowerCase() === want);
  }

  if (hasFilterValue(filters.search)) {
    hits = hits.filter((h) => matchesSearch(h._source || {}, filters.search));
  }

  const total = hits.length;
  const start = (safePage - 1) * safeSize;
  const pageHits = hits.slice(start, start + safeSize);

  return {
    devices: pageHits.map(mapOnboardRow),
    total,
    page: safePage,
    pageSize: safeSize,
    models,
  };
}

function fail(message, status, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  throw err;
}

function isNotFound(err) {
  return err?.meta?.statusCode === 404 || err?.statusCode === 404;
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function currentSlots(src = {}) {
  const slots = {};
  for (const key of ONBOARD_IFACE_SLOTS) {
    slots[key] = String(src[key] || '').trim();
  }
  return slots;
}

function assertCanAssign(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '7' || role === '1') return;
  fail('You do not have permission to assign onboard devices', 403);
}

function assertOrgBranchScope(session = {}, orgId, branchId) {
  if (session.isSuperAdmin) return;
  const sessionOrg = String(session.orgId || '').trim();
  const sessionBranch = String(session.branchId || '').trim();
  if (sessionOrg && sessionOrg !== orgId) {
    fail('Organization is outside your scope', 403);
  }
  if (session.role === '1' || session.isBranchAdmin) {
    if (sessionBranch && sessionBranch !== branchId) {
      fail('Branch is outside your scope', 403);
    }
  }
}

async function getIndexDoc(index, id) {
  try {
    const { body } = await client.get({ index, id });
    if (!body?.found) return null;
    return { id: body._id, ...(body._source || {}) };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function requireUnassignedDevice(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) fail('deviceId is required', 400);

  let body;
  try {
    ({ body } = await client.get({ index: INDICES.DEVICES, id }));
  } catch (err) {
    if (isNotFound(err)) fail('Device not found', 404);
    throw err;
  }
  if (!body?.found) fail('Device not found', 404);

  const src = body._source || {};
  if (src.deleted === true) fail('Device not found', 404);
  if (isAssigned(src)) fail('Device is already assigned', 409);
  return { id: body._id, src };
}

/**
 * One unassigned CPE plus SLA defaults and reported iface names for the assign form.
 */
export async function getOnboardDevice(deviceId) {
  const { id, src } = await requireUnassignedDevice(deviceId);
  const ifaces = listedDeviceIfaces(src);

  return {
    id,
    hostname: src.sysname || 'Unknown',
    model: src.model || 'N/A',
    version: normalizeVersion(src.version),
    interfaces: ifaces,
    assignableInterfaces: listedAssignableIfaces(src),
    interface_name: readInterfaceNameMap(src),
    slots: currentSlots(src),
    tags: src.tags || '',
    latency: normalizeLinkSla(src.latency, DEFAULT_LATENCY_SLA),
    jitter: normalizeLinkSla(src.jitter, DEFAULT_JITTER_SLA),
    defaults: {
      latency: { ...DEFAULT_LATENCY_SLA },
      jitter: { ...DEFAULT_JITTER_SLA },
    },
    ifaceSlots: [...ONBOARD_IFACE_SLOTS],
    operators: [...INTERFACE_OPERATORS],
  };
}

/**
 * Assign onboard CPE(s): write org/branch, optional tags, SLA bands, iface slots,
 * and `interface_name`, then push UCI orgId/branchId.
 */
export async function assignOnboardDevices(payload = {}, session = {}) {
  assertCanAssign(session);

  const orgId = String(payload.orgId || '').trim();
  const branchId = String(payload.branchId || '').trim();
  const uid = String(session.userId || session.email || 'system').trim();
  const tags = payload.tags != null ? String(payload.tags).trim() : null;

  const deviceIds = Array.isArray(payload.deviceIds)
    ? payload.deviceIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [String(payload.deviceId || '').trim()].filter(Boolean);

  if (!orgId || !branchId) fail('orgId and branchId are required', 400);
  if (!deviceIds.length) fail('deviceIds must be a non-empty array', 400);
  assertOrgBranchScope(session, orgId, branchId);

  const orgDoc = await getIndexDoc(INDICES.ORGANIZATIONS, orgId);
  if (!orgDoc) fail('Organization not found', 404);

  const branchDoc = await getIndexDoc(INDICES.BRANCHES, branchId);
  if (!branchDoc) fail('Branch not found', 404);

  const branchOrgId = String(branchDoc.orgId || '').trim();
  if (branchOrgId && branchOrgId !== orgId) {
    fail('Branch does not belong to organization', 400);
  }

  const mget = await client.mget({
    index: INDICES.DEVICES,
    body: { ids: deviceIds },
  });

  const missingIds = [];
  const assignedIds = [];
  const valid = [];

  for (const doc of mget.body?.docs || []) {
    if (!doc?.found) {
      missingIds.push(doc?._id);
      continue;
    }
    const src = doc._source || {};
    if (src.deleted === true || isAssigned(src)) {
      assignedIds.push(doc._id);
      continue;
    }
    valid.push({ id: doc._id, src });
  }

  if (missingIds.length) fail('One or more devices not found', 404, { missingIds });
  if (assignedIds.length) fail('One or more devices already assigned', 409, { assignedIds });

  const latency = normalizeLinkSla(payload.latency, DEFAULT_LATENCY_SLA);
  const jitter = normalizeLinkSla(payload.jitter, DEFAULT_JITTER_SLA);
  const now = nowEpoch();
  const updatedIds = [];
  const taskResults = [];

  for (const row of valid) {
    const ifaceMap = normalizeOnboardIfaceMap(row.src, payload.interfaces || payload.slots || {});
    const nameMap = normalizeInterfaceNameMap(row.src, payload);
    const doc = {
      orgId,
      branchId,
      lastupdated: now,
      latency,
      jitter,
      ...ifaceMap,
    };
    if (tags != null) doc.tags = tags;
    if (Object.keys(nameMap).length) doc.interface_name = nameMap;

    await client.update({
      index: INDICES.DEVICES,
      id: row.id,
      body: { doc },
      refresh: 'wait_for',
    });

    const verify = await client.get({ index: INDICES.DEVICES, id: row.id });
    const verifySrc = verify.body?._source || {};
    if (String(verifySrc.orgId || '').trim() !== orgId || String(verifySrc.branchId || '').trim() !== branchId) {
      fail(`Failed to persist assignment for device ${row.id}`, 500, {
        id: row.id,
        orgId: verifySrc.orgId || '',
        branchId: verifySrc.branchId || '',
      });
    }
    updatedIds.push(row.id);

    try {
      const taskResult = await pushAssignmentUci({
        uid,
        devId: row.id,
        orgId,
        branchId,
      });
      taskResults.push({ deviceId: row.id, ...taskResult });
    } catch (taskErr) {
      taskResults.push({ deviceId: row.id, taskError: taskErr.message || 'MQTT push failed' });
    }
  }

  return {
    updatedCount: updatedIds.length,
    updatedIds,
    orgId,
    branchId,
    taskResults,
  };
}

/**
 * Hard-delete an unassigned CPE, wipe telemetry, write device_deleted_logs.
 */
export async function deleteOnboardDevice(deviceId, session = {}) {
  return deleteUnassignedDevice(deviceId, session);
}

