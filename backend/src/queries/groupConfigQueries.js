import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  buildSessionFilters,
  DEVICE_STATUS,
  getActivityCutoff,
  getDeviceStatus,
  isAssigned,
} from '../config/deviceStatusConfig.js';
import { GROUP_ACT_TYPES } from '../config/groupConfigConfig.js';

const LIST_SOURCE = Object.freeze([
  'act_name',
  'act_type',
  'model',
  't_name',
  'f_name',
  'orgId',
  'total_dev',
  'act_status',
  'complete',
  'fail',
  'pending',
  'start_time',
  'datecreated',
]);

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function isNotFound(err) {
  return err?.meta?.statusCode === 404 || err?.statusCode === 404;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

function statusError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function asIdList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (value == null || value === '') return [];
  return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
}

function notFoundError(message = 'Group config not found') {
  return statusError(message, 404);
}

export function assertOrgAccess(session = {}, requestedOrgId) {
  const orgId = String(requestedOrgId || '').trim();
  if (!orgId) throw statusError('orgId is required', 400);
  if (!session.isSuperAdmin && session.orgId && session.orgId !== orgId) {
    throw statusError('Cannot access data outside your organization', 403);
  }
  return orgId;
}

async function mgetByIds(index, ids, sourceFields = []) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  try {
    const { body } = await client.mget({
      index,
      body: {
        docs: uniqueIds.map((id) => ({
          _id: id,
          ...(sourceFields.length ? { _source: sourceFields } : {}),
        })),
      },
    });

    const map = new Map();
    for (const doc of body?.docs || []) {
      if (!doc?.found) continue;
      map.set(String(doc._id), doc._source || {});
    }
    return map;
  } catch (err) {
    if (isIndexMissing(err) || isNotFound(err)) return new Map();
    throw err;
  }
}

async function getConfigSource(id) {
  const docId = String(id || '').trim();
  if (!docId) throw statusError('id is required', 400);

  try {
    const { body } = await client.get({
      index: INDICES.GROUP_CONF,
      id: docId,
    });
    if (!body?.found || !body._source) throw notFoundError();
    return { id: docId, ...body._source };
  } catch (err) {
    if (err.status) throw err;
    if (isNotFound(err) || isIndexMissing(err)) throw notFoundError();
    throw err;
  }
}

async function requireConfigAccess(id, session = {}) {
  const config = await getConfigSource(id);
  if (config.orgId) assertOrgAccess(session, config.orgId);
  return config;
}

async function replaceGroupActions(actId, deviceIds) {
  const now = nowEpoch();
  try {
    await client.deleteByQuery({
      index: INDICES.GROUP_ACTION,
      body: { query: { term: { 'act_id.keyword': actId } } },
      refresh: true,
      conflicts: 'proceed',
    });
  } catch (err) {
    if (!isIndexMissing(err)) throw err;
  }

  if (!deviceIds.length) return;

  const ops = [];
  for (const devId of deviceIds) {
    ops.push({ index: { _index: INDICES.GROUP_ACTION, _id: `${actId}:${devId}` } });
    ops.push({ act_id: actId, devId, datecreated: now });
  }

  await client.bulk({ refresh: true, body: ops });
}

export async function assertDevicesInScope({ orgId, model, deviceIds, session = {} }) {
  const ids = asIdList(deviceIds);
  if (!ids.length) throw statusError('deviceIds is required', 400);

  const filter = [
    ...buildSessionFilters(session),
    { ids: { values: ids } },
    { term: { 'orgId.keyword': orgId } },
  ];

  if (model) {
    filter.push({
      bool: {
        should: [
          { term: { 'model.keyword': model } },
          { term: { model } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: ids.length,
        query: { bool: { filter } },
        _source: ['orgId', 'branchId', 'model'],
      },
    });

    const hits = (body?.hits?.hits || []).filter((hit) => isAssigned(hit._source || {}));
    if (hits.length !== ids.length) {
      throw statusError('One or more devices are invalid or out of scope', 400);
    }
  } catch (err) {
    if (err.status) throw err;
    if (isIndexMissing(err)) throw statusError('One or more devices are invalid or out of scope', 400);
    throw err;
  }
}

export async function listGroupConfigs(session = {}) {
  const filter = [];
  if (!session.isSuperAdmin) {
    const orgId = String(session.orgId || '').trim();
    if (!orgId) return { items: [], orgId: '' };
    filter.push({ term: { 'orgId.keyword': orgId } });
  }

  try {
    const { body } = await client.search({
      index: INDICES.GROUP_CONF,
      body: {
        size: 1000,
        query: filter.length ? { bool: { filter } } : { match_all: {} },
        sort: [{ datecreated: { order: 'desc', unmapped_type: 'long' } }],
        _source: LIST_SOURCE,
      },
    });

    const items = (body?.hits?.hits || []).map((hit) => {
      const src = hit._source || {};
      const pending = Number(src.pending ?? 0);
      const startTime = Number(src.start_time ?? 0);
      return {
        id: hit._id,
        act_name: src.act_name ?? '',
        act_type: src.act_type ?? '',
        model: src.model ?? '',
        t_name: src.t_name ?? '',
        f_name: src.f_name ?? '',
        orgId: src.orgId ?? '',
        total_dev: Number(src.total_dev ?? 0),
        complete: Number(src.complete ?? 0),
        fail: Number(src.fail ?? 0),
        pending,
        act_status: pending === 0 ? 'Completed' : String(src.act_status ?? ''),
        start_time: startTime,
        runMode: startTime < 1000 ? 0 : 1,
      };
    });

    return { items, orgId: session.isSuperAdmin ? '' : String(session.orgId || '') };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { items: [], orgId: session.isSuperAdmin ? '' : String(session.orgId || '') };
    }
    throw err;
  }
}

export async function listGroupDevices({ orgId, model, selectedIds = [], session = {} }) {
  const scopedOrgId = assertOrgAccess(session, orgId);
  const requestedModel = String(model || '').trim();
  if (!requestedModel) throw statusError('model is required', 400);

  const filter = [
    ...buildSessionFilters(session),
    { term: { 'orgId.keyword': scopedOrgId } },
    {
      bool: {
        should: [
          { term: { 'model.keyword': requestedModel } },
          { term: { model: requestedModel } },
        ],
        minimum_should_match: 1,
      },
    },
  ];

  let hits = [];
  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: 10000,
        query: { bool: { filter } },
        _source: ['sysname', 'orgId', 'branchId', 'model', 'version', 'slu', 'lastupdated'],
      },
    });
    hits = (body?.hits?.hits || []).filter((hit) => isAssigned(hit._source || {}));
  } catch (err) {
    if (isIndexMissing(err)) return { devices: [] };
    throw err;
  }

  const orgIds = [...new Set(hits.map((hit) => String(hit._source?.orgId || '')).filter(Boolean))];
  const orgNameById = await mgetByIds(INDICES.ORGANIZATIONS, orgIds, ['org_name', 'org']);
  const cutoff = getActivityCutoff();
  const selectedSet = new Set(asIdList(selectedIds));

  return {
    devices: hits.map((hit) => {
      const src = hit._source || {};
      const orgSrc = orgNameById.get(String(src.orgId || '')) || {};
      return {
        id: hit._id,
        sysname: src.sysname || '',
        model: src.model || '',
        version: src.version || '',
        up: getDeviceStatus(src, cutoff) === DEVICE_STATUS.UP,
        orgName: orgSrc.org_name || orgSrc.org || '',
        selected: selectedSet.has(String(hit._id)),
      };
    }),
  };
}

export async function getGroupConfig(id, session = {}) {
  const config = await requireConfigAccess(id, session);

  let selectedIds = [];
  try {
    const { body } = await client.search({
      index: INDICES.GROUP_ACTION,
      body: {
        size: 10000,
        query: { term: { 'act_id.keyword': id } },
        _source: ['devId'],
      },
    });
    selectedIds = (body?.hits?.hits || []).map((hit) => hit._source?.devId).filter(Boolean);
  } catch (err) {
    if (!isIndexMissing(err)) throw err;
  }

  return { config, selectedIds };
}

export async function createGroupConfig({ id, uid, payload, deviceIds }) {
  const now = nowEpoch();
  const doc = {
    act_name: payload.act_name,
    act_type: payload.act_type,
    orgId: payload.orgId,
    model: payload.model,
    t_name: payload.t_name || '',
    f_name: payload.f_name || '',
    keep: payload.keep ? 1 : 0,
    force: payload.force ? 1 : 0,
    uid: uid || '',
    total_dev: deviceIds.length,
    datecreated: now,
    act_status: 'Created',
    complete: 0,
    fail: 0,
    pending: deviceIds.length,
    start_time: 0,
  };

  await client.index({
    index: INDICES.GROUP_CONF,
    id,
    body: doc,
    refresh: true,
  });

  try {
    await replaceGroupActions(id, deviceIds);
  } catch (err) {
    try {
      await client.delete({ index: INDICES.GROUP_CONF, id, refresh: true });
    } catch {
      // best-effort rollback
    }
    throw err;
  }

  return { id };
}

export async function updateGroupConfig(id, session, { act_name, deviceIds }) {
  const existing = await requireConfigAccess(id, session);

  await client.update({
    index: INDICES.GROUP_CONF,
    id,
    body: {
      doc: {
        act_name,
        total_dev: deviceIds.length,
        pending: deviceIds.length,
        complete: 0,
        fail: 0,
        act_status: 'Created',
        start_time: 0,
      },
    },
    refresh: true,
  });

  await replaceGroupActions(id, deviceIds);
  return { ok: true, orgId: existing.orgId, model: existing.model };
}

export async function deleteGroupConfig(id, session) {
  await requireConfigAccess(id, session);

  try {
    await client.delete({ index: INDICES.GROUP_CONF, id, refresh: true });
  } catch (err) {
    if (!isNotFound(err) && !isIndexMissing(err)) throw err;
  }

  try {
    await client.deleteByQuery({
      index: INDICES.GROUP_ACTION,
      body: { query: { term: { 'act_id.keyword': id } } },
      refresh: true,
      conflicts: 'proceed',
    });
  } catch (err) {
    if (!isIndexMissing(err)) throw err;
  }

  return { ok: true };
}

export async function listActionsToRun(actId, { retryMode = false } = {}) {
  const query = {
    bool: {
      filter: [{ term: { 'act_id.keyword': actId } }],
    },
  };

  if (retryMode) {
    query.bool.filter.push({ exists: { field: 'status' } });
    query.bool.must_not = [
      {
        bool: {
          should: [
            { term: { status: 0 } },
            { term: { 'status.keyword': '0' } },
          ],
          minimum_should_match: 1,
        },
      },
    ];
  }

  try {
    const { body } = await client.search({
      index: INDICES.GROUP_ACTION,
      body: {
        size: 10000,
        query,
        _source: ['devId'],
      },
    });
    return (body?.hits?.hits || []).map((hit) => hit._source?.devId).filter(Boolean);
  } catch (err) {
    if (isIndexMissing(err)) return [];
    throw err;
  }
}

export async function updateGroupAction(actId, devId, doc) {
  await client.update({
    index: INDICES.GROUP_ACTION,
    id: `${actId}:${devId}`,
    body: { doc },
    refresh: false,
  });
}

export async function updateGroupConf(id, doc) {
  await client.update({
    index: INDICES.GROUP_CONF,
    id,
    body: { doc },
    refresh: true,
  });
}

export async function listGroupActions(actId) {
  try {
    const { body } = await client.search({
      index: INDICES.GROUP_ACTION,
      body: {
        size: 10000,
        query: { term: { 'act_id.keyword': actId } },
        _source: ['devId', 'task_id', 'status', 'result', 'process', 'msg', 'sent', 'created', 'type', 'task'],
      },
    });
    return body?.hits?.hits || [];
  } catch (err) {
    if (isIndexMissing(err)) return [];
    throw err;
  }
}

export async function refreshGroupConfig(id, session = {}) {
  const conf = await requireConfigAccess(id, session);
  const actionHits = await listGroupActions(id);
  const taskIds = actionHits.map((hit) => String(hit._source?.task_id || '')).filter(Boolean);
  const taskById = await mgetByIds(INDICES.TASKS_LOGS, taskIds);

  let processed = 0;
  let successCount = 0;

  for (const hit of actionHits) {
    const src = hit._source || {};
    const devId = String(src.devId || '').trim();
    const taskId = String(src.task_id || '').trim();
    if (!devId || !taskId) continue;

    const task = taskById.get(taskId) || {};
    const status = task.status ?? null;
    const hasStatus = status !== null && status !== undefined && status !== '';
    if (hasStatus) {
      processed += 1;
      if (status === 0 || status === '0' || Number(status) === 0) {
        successCount += 1;
      }
    }

    await updateGroupAction(id, devId, {
      process: task.process ?? null,
      result: task.result ?? null,
      status: task.status ?? null,
      msg: task.msg ?? null,
      sent: task.sent ?? null,
      created: task.created ?? null,
      type: task.type ?? null,
      task: task.task ?? null,
    });
  }

  const total = Number(conf.total_dev ?? 0);
  const pending = Math.max(0, total - processed);
  const fail = Math.max(0, processed - successCount);

  await updateGroupConf(id, {
    complete: successCount,
    fail,
    pending,
    act_status: pending === 0 ? 'Completed' : String(conf.act_status || 'Initiated'),
  });

  return { total, complete: successCount, fail, pending };
}

export async function getGroupConfigDetails(id, session = {}) {
  await requireConfigAccess(id, session);
  const actionHits = await listGroupActions(id);
  const devIds = [...new Set(actionHits.map((hit) => String(hit._source?.devId || '')).filter(Boolean))];
  const taskIds = [...new Set(actionHits.map((hit) => String(hit._source?.task_id || '')).filter(Boolean))];

  const [devicesById, taskById] = await Promise.all([
    mgetByIds(INDICES.DEVICES, devIds, ['sysname']),
    mgetByIds(INDICES.TASKS_LOGS, taskIds, ['task', 'type', 'created', 'sent', 'process', 'result', 'status', 'msg']),
  ]);

  return {
    items: actionHits.map((hit) => {
      const src = hit._source || {};
      const devId = String(src.devId || '').trim();
      const taskId = String(src.task_id || '').trim();
      const task = taskById.get(taskId) || {};
      const device = devicesById.get(devId) || {};

      return {
        devId,
        hostname: device.sysname || '',
        task_id: taskId,
        task: task.task ?? src.task ?? null,
        type: task.type ?? src.type ?? null,
        created: task.created ?? src.created ?? null,
        sent: task.sent ?? src.sent ?? null,
        process: task.process ?? src.process ?? null,
        result: task.result ?? src.result ?? null,
        status: task.status ?? src.status ?? null,
        msg: task.msg ?? src.msg ?? null,
      };
    }),
  };
}

export function isConfigAction(actType) {
  return String(actType || '').trim() === GROUP_ACT_TYPES.CONFIG;
}

export function isUpgradeAction(actType) {
  return String(actType || '').trim() === GROUP_ACT_TYPES.UPGRADE;
}

export { requireConfigAccess };
