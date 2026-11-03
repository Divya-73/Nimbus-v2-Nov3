import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  buildSessionFilters,
  DEFAULT_JITTER_SLA,
  DEFAULT_LATENCY_SLA,
  INTERFACE_OPERATORS,
  isAssigned,
  listedAssignableIfaces,
  listedDeviceIfaces,
  normalizeInterfaceNameMap,
  normalizeLinkSla,
  normalizeOnboardIfaceMap,
  ONBOARD_IFACE_SLOTS,
  readInterfaceNameMap,
} from '../config/deviceStatusConfig.js';
import { pushAssignmentUci } from './mqttQueries.js';

function fail(message, status, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  throw err;
}

function isNotFound(err) {
  return err?.meta?.statusCode === 404 || err?.statusCode === 404;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function assertCanWrite(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '7' || role === '1') return;
  fail('You do not have permission to edit this device', 403);
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

function assertPlaceScope(session = {}, orgId, branchId) {
  if (session.isSuperAdmin) return;
  const sessionOrg = String(session.orgId || '').trim();
  const sessionBranch = String(session.branchId || '').trim();
  if (sessionOrg && sessionOrg !== orgId) {
    fail('Organization is outside your scope', 403);
  }
  if (session.isBranchAdmin || session.role === '1') {
    if (sessionBranch && sessionBranch !== branchId) {
      fail('Branch is outside your scope', 403);
    }
  }
}

async function requireAssignedDevice(deviceId, session = {}) {
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
  if (!isAssigned(src)) fail('Device not found', 404);

  const scopeFilters = buildSessionFilters(session);
  if (scopeFilters.length) {
    const { body: check } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: 1,
        query: {
          bool: {
            filter: [...scopeFilters, { ids: { values: [body._id] } }],
          },
        },
        _source: false,
      },
    });
    if (!(check.hits?.hits || []).length) fail('Device not found', 404);
  }

  return { id: body._id, src };
}

function mapPayload({ id, src }) {
  return {
    id,
    hostname: src.sysname || 'Unknown',
    orgId: String(src.orgId || '').trim(),
    branchId: String(src.branchId || '').trim(),
    zone: String(src.zone || '').trim(),
    region: String(src.region || '').trim(),
    org: String(src.org || src.org_name || '').trim(),
    branch: String(src.branch || '').trim(),
  };
}

/** GET assigned-device org/branch/zone/region for Device Performance edit. */
export async function getDeviceInterfaceMap(deviceId, session = {}) {
  const row = await requireAssignedDevice(deviceId, session);
  return mapPayload(row);
}

/**
 * Edit assigned-device org/branch/zone/region only.
 * Does not write interface_name, LAN/WAN/SIM slots, or SLA.
 * Org/branch cannot be cleared (that would send the CPE back to On Board).
 */
export async function updateDeviceInterfaceMap(deviceId, payload = {}, session = {}) {
  assertCanWrite(session);
  const { id, src } = await requireAssignedDevice(deviceId, session);

  const currentOrgId = String(src.orgId || '').trim();
  const currentBranchId = String(src.branchId || '').trim();
  let orgId = currentOrgId;
  let branchId = currentBranchId;
  let zone = String(src.zone || '').trim();
  let region = String(src.region || '').trim();

  const placeTouched =
    hasOwn(payload, 'orgId') ||
    hasOwn(payload, 'branchId') ||
    hasOwn(payload, 'zone') ||
    hasOwn(payload, 'region');

  if (!placeTouched) fail('orgId, branchId, zone, or region is required', 400);

  if (hasOwn(payload, 'orgId')) {
    orgId = String(payload.orgId ?? '').trim();
    if (!orgId) fail('Organization is required', 400);
    if (!session.isSuperAdmin && orgId !== currentOrgId) {
      fail('You can only update devices within your organization', 403);
    }
  }
  if (hasOwn(payload, 'branchId')) {
    branchId = String(payload.branchId ?? '').trim();
    if (!branchId) fail('Branch is required', 400);
  }
  if (hasOwn(payload, 'zone')) zone = String(payload.zone ?? '').trim();
  if (hasOwn(payload, 'region')) region = String(payload.region ?? '').trim();

  assertPlaceScope(session, orgId, branchId);

  const doc = {};
  const orgChanged = orgId !== currentOrgId;
  const branchChanged = branchId !== currentBranchId;

  if (orgChanged || branchChanged) {
    const orgDoc = await getIndexDoc(INDICES.ORGANIZATIONS, orgId);
    if (!orgDoc) fail('Organization not found', 404);
    const branchDoc = await getIndexDoc(INDICES.BRANCHES, branchId);
    if (!branchDoc) fail('Branch not found', 404);
    const branchOrgId = String(branchDoc.orgId || '').trim();
    if (branchOrgId && branchOrgId !== orgId) {
      fail('Selected branch does not belong to the selected organization', 400);
    }
    doc.org = String(orgDoc.org_name || orgDoc.org || '').trim();
    doc.branch = String(branchDoc.branch || '').trim();
  }
  if (hasOwn(payload, 'orgId') || orgChanged) doc.orgId = orgId;
  if (hasOwn(payload, 'branchId') || branchChanged) doc.branchId = branchId;
  if (hasOwn(payload, 'zone')) doc.zone = zone;
  if (hasOwn(payload, 'region')) doc.region = region;

  if (!Object.keys(doc).length) fail('No assignment fields to update', 400);

  await client.update({
    index: INDICES.DEVICES,
    id,
    body: { doc },
    refresh: 'wait_for',
  });

  if (orgChanged || branchChanged) {
    try {
      await pushAssignmentUci({
        uid: String(session.userId || session.email || 'system').trim(),
        devId: id,
        orgId,
        branchId,
      });
    } catch {
      // Inventory write is authoritative if MQTT fails.
    }
  }

  const verify = await client.get({ index: INDICES.DEVICES, id });
  const verifySrc = verify.body?._source || {};
  if (String(verifySrc.orgId || '').trim() !== orgId || String(verifySrc.branchId || '').trim() !== branchId) {
    fail(`Failed to persist assignment for device ${id}`, 500);
  }
  return mapPayload({ id, src: verifySrc });
}

function currentSlots(src = {}) {
  const slots = {};
  for (const key of ONBOARD_IFACE_SLOTS) {
    slots[key] = String(src[key] || '').trim();
  }
  return slots;
}

function mapOnboardConfig({ id, src }) {
  return {
    id,
    hostname: src.sysname || 'Unknown',
    tags: src.tags || '',
    interfaces: listedDeviceIfaces(src),
    assignableInterfaces: listedAssignableIfaces(src),
    interface_name: readInterfaceNameMap(src),
    slots: currentSlots(src),
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

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

/** GET assigned-device tags, slots, interface_name, and SLA for post-onboard edit. */
export async function getDeviceOnboardConfig(deviceId, session = {}) {
  const row = await requireAssignedDevice(deviceId, session);
  return mapOnboardConfig(row);
}

/**
 * Edit assigned-device tags, LAN/WAN/SIM slots, interface_name, and SLA.
 * Does not change org/branch/zone/region.
 */
export async function updateDeviceOnboardConfig(deviceId, payload = {}, session = {}) {
  assertCanWrite(session);
  const { id, src } = await requireAssignedDevice(deviceId, session);

  const touched =
    hasOwn(payload, 'tags') ||
    hasOwn(payload, 'interfaces') ||
    hasOwn(payload, 'slots') ||
    hasOwn(payload, 'interface_name') ||
    hasOwn(payload, 'latency') ||
    hasOwn(payload, 'jitter');
  if (!touched) fail('tags, interfaces, interface_name, latency, or jitter is required', 400);

  const doc = { lastupdated: nowEpoch() };
  let replaceInterfaceName = false;
  let interfaceName = {};

  if (hasOwn(payload, 'tags')) {
    doc.tags = String(payload.tags ?? '').trim();
  }

  if (hasOwn(payload, 'interfaces') || hasOwn(payload, 'slots')) {
    const raw = payload.interfaces && typeof payload.interfaces === 'object'
      ? payload.interfaces
      : payload.slots && typeof payload.slots === 'object'
        ? payload.slots
        : {};
    const full = {};
    for (const slot of ONBOARD_IFACE_SLOTS) {
      full[slot] = hasOwn(raw, slot) ? raw[slot] : (src[slot] || '');
    }
    const deviceForSlots = {
      ...src,
      interfaces: [...new Set([
        ...listedDeviceIfaces(src),
        ...ONBOARD_IFACE_SLOTS.map((slot) => String(src[slot] || '').trim()).filter(Boolean),
      ])],
    };
    Object.assign(doc, normalizeOnboardIfaceMap(deviceForSlots, full));
  }

  if (hasOwn(payload, 'interface_name')) {
    replaceInterfaceName = true;
    const existingNames = Object.keys(readInterfaceNameMap(src));
    const deviceForNames = {
      ...src,
      interfaces: [...new Set([...listedDeviceIfaces(src), ...existingNames])],
    };
    interfaceName = normalizeInterfaceNameMap(deviceForNames, payload);
  }

  if (hasOwn(payload, 'latency')) {
    doc.latency = normalizeLinkSla(
      { ...(src.latency || {}), ...(payload.latency || {}) },
      DEFAULT_LATENCY_SLA
    );
  }
  if (hasOwn(payload, 'jitter')) {
    doc.jitter = normalizeLinkSla(
      { ...(src.jitter || {}), ...(payload.jitter || {}) },
      DEFAULT_JITTER_SLA
    );
  }

  if (replaceInterfaceName) {
    await client.update({
      index: INDICES.DEVICES,
      id,
      refresh: 'wait_for',
      body: {
        script: {
          lang: 'painless',
          source: `
            if (params.clearInterfaceName) {
              ctx._source.remove('interface_name');
            } else {
              ctx._source.interface_name = params.interfaceName;
            }
            for (entry in params.doc.entrySet()) {
              ctx._source[entry.getKey()] = entry.getValue();
            }
          `,
          params: {
            clearInterfaceName: Object.keys(interfaceName).length === 0,
            interfaceName,
            doc,
          },
        },
      },
    });
  } else {
    await client.update({
      index: INDICES.DEVICES,
      id,
      body: { doc },
      refresh: 'wait_for',
    });
  }

  const verify = await client.get({ index: INDICES.DEVICES, id });
  return mapOnboardConfig({ id, src: verify.body?._source || {} });
}
