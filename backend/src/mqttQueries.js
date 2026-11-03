import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { getDeviceDetail } from './deviceDetailQueries.js';
import { publishToDevice } from '../config/mqttConfig.js';
import { v4 as uuidv4 } from 'uuid';

function nowEpoch() {
  return Date.now() / 1000;
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

const SENSITIVE_KEYS = new Set(['srv', 'port', 'user', 'pass', 'password']);

export function sanitizeSensitiveParams(params = {}) {
  const cleaned = { ...params };
  for (const key of SENSITIVE_KEYS) delete cleaned[key];
  return cleaned;
}

export function redactTasklog(tasklog = {}) {
  return sanitizeSensitiveParams(tasklog);
}

export async function assertDeviceAccess(devId, session = {}) {
  const id = String(devId || '').trim();
  if (!id) throw statusError('devId is required', 400);
  try {
    return await getDeviceDetail(id, session);
  } catch (err) {
    if (/not found/i.test(err.message)) throw statusError(err.message, 404);
    throw err;
  }
}

/** orgId / branchId for task logs — always from the target CPE, not the logged-in user. */
export async function getDeviceOrgBranch(devId) {
  const id = String(devId || '').trim();
  if (!id) return { orgId: '', branchId: '' };

  try {
    const { body } = await client.get({
      index: INDICES.DEVICES,
      id,
      _source: ['orgId', 'branchId'],
    });
    const src = body?._source || {};
    return {
      orgId: String(src.orgId || '').trim(),
      branchId: String(src.branchId || '').trim(),
    };
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) return { orgId: '', branchId: '' };
    throw err;
  }
}

export async function assertTaskLogAccess(tasklog, session = {}) {
  if (!tasklog) throw statusError('Task log not found', 404);

  if (session.isSuperAdmin) return tasklog;

  if (tasklog.devId) {
    await assertDeviceAccess(tasklog.devId, session);
    return tasklog;
  }

  const orgId = String(session.orgId || '').trim();
  const logOrgId = String(tasklog.orgId || '').trim();
  if (orgId && logOrgId && orgId === logOrgId) return tasklog;

  throw statusError('Task log not found', 404);
}

export async function createTaskDocument({ id, body }) {
  await client.index({
    index: INDICES.TASKS_DETAILS,
    id,
    body,
    refresh: true,
  });
  return { taskId: id };
}

export async function createTaskLogDocument({ id, body }) {
  await client.index({
    index: INDICES.TASKS_LOGS,
    id,
    body,
    refresh: true,
  });
  return { reqId: id };
}

export async function getTaskLogById(reqId) {
  const id = String(reqId || '').trim();
  if (!id) throw statusError('reqId is required', 400);

  try {
    const { body } = await client.get({
      index: INDICES.TASKS_LOGS,
      id,
    });
    if (!body?.found) throw statusError('Task log not found', 404);
    return redactTasklog({ reqId: id, ...body._source });
  } catch (err) {
    if (isNotFound(err) || isIndexMissing(err)) throw statusError('Task log not found', 404);
    throw err;
  }
}

export async function findTaskByName(name, session = {}) {
  const taskName = String(name || '').trim();
  if (!taskName) throw statusError('name is required', 400);

  const filter = [];
  if (session.orgId) filter.push({ term: { 'orgId.keyword': String(session.orgId).trim() } });
  if (session.branchId) filter.push({ term: { 'branchId.keyword': String(session.branchId).trim() } });

  try {
    const { body } = await client.search({
      index: INDICES.TASKS_DETAILS,
      body: {
        size: 1,
        query: {
          bool: {
            filter,
            must: [
              {
                bool: {
                  should: [
                    { match_phrase: { 'data.task': taskName } },
                    { match: { 'data.task': taskName } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
        sort: [{ 'data.start': { order: 'desc', unmapped_type: 'double' } }],
      },
    });

    const hits = body?.hits?.hits || [];
    const total = body?.hits?.total;
    return {
      found: hits.length > 0,
      total: typeof total === 'number' ? total : Number(total?.value) || hits.length,
      latest: hits[0]?._source ? sanitizeSensitiveParams(hits[0]._source) : null,
      id: hits[0]?._id || null,
    };
  } catch (err) {
    if (isIndexMissing(err)) {
      return { found: false, total: 0, latest: null, id: null };
    }
    throw err;
  }
}

export async function resolveDeviceProduct(devId) {
  const id = String(devId || '').trim();
  if (!id) throw statusError('devId is required', 400);

  try {
    const { body } = await client.search({
      index: INDICES.DEVICE_DETAILS,
      body: {
        size: 1,
        query: {
          bool: {
            must: [
              { match_phrase: { f: 'DEVICE_PRODUCT' } },
              { match_phrase: { devId: id } },
            ],
          },
        },
        _source: ['v'],
      },
    });
    const model = String(body?.hits?.hits?.[0]?._source?.v || '').trim();
    if (model) return model;
  } catch (err) {
    if (!isIndexMissing(err) && !isNotFound(err)) throw err;
  }

  try {
    const { body } = await client.get({
      index: INDICES.DEVICES,
      id,
    });
    const model = String(body?._source?.model || '').trim();
    if (model) return model;
  } catch {
    // ignore
  }

  return '';
}

export function buildTaskBody({ uid, task, cmd, args = {}, type = 'adhoc', orgId, branchId }) {
  return sanitizeSensitiveParams({
    cmd,
    type,
    uid,
    orgId: orgId || '',
    branchId: branchId || '',
    data: {
      task,
      cmds: [cmd],
      start: nowEpoch(),
      repeat: 'none',
    },
    ...args,
  });
}

export function buildTaskLogBody({
  uid,
  taskId,
  task,
  devId,
  cmd,
  args = {},
  type = 'adhoc',
  orgId,
  branchId,
}) {
  const timestamp = nowEpoch();
  return sanitizeSensitiveParams({
    uid,
    cmd,
    type,
    task,
    taskId,
    devId,
    orgId: orgId || '',
    branchId: branchId || '',
    created: timestamp,
    sent: timestamp,
    lastupdated: timestamp,
    ...args,
  });
}

/** Push org/branch UCI to a CPE after inventory assign. MQTT failure is the caller's problem. */
export async function pushAssignmentUci({
  uid,
  devId,
  orgId,
  branchId,
}) {
  const reqId = uuidv4();
  const taskId = uuidv4();
  const args = {
    opts: [
      `set aheesaNMC.globals.orgId="${orgId}"`,
      `set aheesaNMC.globals.branchId="${branchId}"`,
    ],
    chk: ['aheesaNMC.globals.orgId'],
  };

  await createTaskDocument({
    id: taskId,
    body: buildTaskBody({
      uid,
      task: 'Assign',
      cmd: 'uci',
      args,
      type: 'adhoc',
      orgId,
      branchId,
    }),
  });

  await createTaskLogDocument({
    id: reqId,
    body: buildTaskLogBody({
      uid,
      taskId,
      task: 'Assign',
      devId,
      cmd: 'uci',
      args,
      type: 'adhoc',
      orgId,
      branchId,
    }),
  });

  await publishToDevice(devId, { cmd: 'uci', reqId, ...args });
  return { reqId, taskId };
}
