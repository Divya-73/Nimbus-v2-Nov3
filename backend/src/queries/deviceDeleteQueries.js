import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  buildSessionFilters,
  isAssigned,
} from '../config/deviceStatusConfig.js';

const TELEMETRY_INDICES = [
  INDICES.DEVICE_DETAILS,
  INDICES.TRAFFIC_DETAILS,
  INDICES.CPU_MEMORY_DETAILS,
  INDICES.LTE_DETAILS,
  INDICES.JITTER_LATENCY_DETAILS,
  INDICES.DISK_DETAILS,
  'pstrans',
];

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function isNotFound(err) {
  return err?.meta?.statusCode === 404 || err?.statusCode === 404;
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

export function assertCanDeleteDevice(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '99' || role === '7' || role === '1') return;
  fail('You do not have permission to delete devices', 403);
}

async function loadDeviceDoc(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) fail('Device id is required', 400);

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
  return { id: body._id, src };
}

async function assertSessionCanSeeDevice(id, session = {}) {
  const scopeFilters = buildSessionFilters(session);
  if (!scopeFilters.length) return;

  const { body } = await client.search({
    index: INDICES.DEVICES,
    body: {
      size: 1,
      query: {
        bool: {
          filter: [...scopeFilters, { ids: { values: [id] } }],
        },
      },
      _source: false,
    },
  });
  if (!(body?.hits?.hits || []).length) fail('Device not found', 404);
}

async function wipeDeviceTelemetry(id) {
  try {
    // Async deleteByQuery — do not block the API response on large telemetry indices.
    await client.deleteByQuery({
      index: TELEMETRY_INDICES,
      body: {
        query: {
          bool: {
            should: [
              { term: { 'devId.keyword': id } },
              { term: { devId: id } },
            ],
            minimum_should_match: 1,
          },
        },
      },
      conflicts: 'proceed',
      ignore_unavailable: true,
      wait_for_completion: false,
      refresh: false,
    });
  } catch {
    // Telemetry wipe is best-effort, same as On Board.
  }
}

async function writeDeviceDeletionLog({ id, src = {}, session = {}, onboard = false }) {
  await client.index({
    index: INDICES.DEVICE_DELETION_LOGS,
    id: `${id}:${nowEpoch()}`,
    body: {
      ...src,
      sysname: src.sysname || '',
      org: src.org || '',
      orgId: src.orgId || '',
      branch: src.branch || '',
      branchId: src.branchId || '',
      model: src.model || '',
      deletedTime: nowEpoch(),
      username: String(session.email || session.username || '').trim(),
      userId: String(session.userId || '').trim(),
      sessionId: String(session.sessionId || '').trim(),
      role: String(session.role || '').trim(),
      onboard: Boolean(onboard),
      deviceId: id,
    },
    refresh: 'wait_for',
  });
}

async function removeDeviceAndLog({ id, src, session, onboard }) {
  try {
    await client.delete({
      index: INDICES.DEVICES,
      id,
      refresh: 'wait_for',
    });
  } catch (err) {
    // OpenSearch does not support Elasticsearch-style `ignore: [404]`.
    if (!isNotFound(err)) throw err;
  }
  await writeDeviceDeletionLog({ id, src, session, onboard });
  // Kick off telemetry cleanup after the device is removed so the client
  // is not blocked by deleteByQuery across large history indices.
  void wipeDeviceTelemetry(id);
  return { deleted: true, deviceId: id };
}

/** Unassigned CPE (On Board). */
export async function deleteUnassignedDevice(deviceId, session = {}) {
  assertCanDeleteDevice(session);
  const { id, src } = await loadDeviceDoc(deviceId);
  if (isAssigned(src)) fail('Device is already assigned', 409);
  return removeDeviceAndLog({ id, src, session, onboard: true });
}

/** Assigned CPE (Device Performance). Scoped by org/branch. */
export async function deleteAssignedDevice(deviceId, session = {}) {
  assertCanDeleteDevice(session);
  const { id, src } = await loadDeviceDoc(deviceId);
  if (!isAssigned(src)) fail('Device not found', 404);
  await assertSessionCanSeeDevice(id, session);
  return removeDeviceAndLog({ id, src, session, onboard: false });
}
