import { v4 as uuidv4 } from 'uuid';
import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { loadTemplateFile } from '../utils/templateUtils.js';
import {
  getCommandCatalogEntry,
  listCommandCatalog,
  publishToDevice,
} from '../config/mqttConfig.js';
import {
  assertScpConfig,
  getCommandOutputPath,
  ensureOutputPlaceholder,
  getScpConfig,
  readOutputFile,
  resolveFirmwarePath,
} from '../config/scpConfig.js';
import {
  assertDeviceAccess,
  assertTaskLogAccess,
  buildTaskBody,
  buildTaskLogBody,
  createTaskDocument,
  createTaskLogDocument,
  findTaskByName,
  getDeviceOrgBranch,
  getTaskLogById,
  resolveDeviceProduct,
} from '../queries/mqttQueries.js';

function buildSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function actorUid(session) {
  return session.userId || session.email || '';
}

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function resolveTaskScope(session, devId, overrides = {}) {
  const fromDevice = devId ? await getDeviceOrgBranch(devId) : { orgId: '', branchId: '' };
  return {
    orgId: overrides.orgId || fromDevice.orgId || session.orgId || '',
    branchId: overrides.branchId || fromDevice.branchId || session.branchId || '',
  };
}

async function createTask(session, {
  task,
  cmd,
  args = {},
  type = 'adhoc',
  orgId = '',
  branchId = '',
}) {
  const uid = actorUid(session);
  if (!uid) fail('Authenticated user context missing', 401);

  const taskId = uuidv4();
  await createTaskDocument({
    id: taskId,
    body: buildTaskBody({
      uid,
      task,
      cmd,
      args,
      type,
      orgId,
      branchId,
    }),
  });
  return { taskId, uid };
}

async function runTask(session, {
  uid,
  taskId,
  task,
  reqId,
  devId,
  cmd,
  args = {},
  type = 'adhoc',
  orgId = '',
  branchId = '',
}) {
  await createTaskLogDocument({
    id: reqId,
    body: buildTaskLogBody({
      uid,
      taskId,
      task,
      devId,
      cmd,
      args,
      type,
      orgId,
      branchId,
    }),
  });

  await publishToDevice(devId, { cmd, reqId, ...args });
  return reqId;
}

async function createAndRunTask(session, {
  uid,
  devId,
  task,
  reqId,
  cmd,
  args = {},
  taskId = null,
  type = 'adhoc',
  orgId = '',
  branchId = '',
}) {
  const scope = await resolveTaskScope(session, devId, { orgId, branchId });

  let actualTaskId = taskId;
  let actualUid = uid;

  if (!actualTaskId) {
    const created = await createTask(session, {
      task,
      cmd,
      args,
      type,
      orgId: scope.orgId,
      branchId: scope.branchId,
    });
    actualTaskId = created.taskId;
    actualUid = created.uid;
  }

  if (!actualUid) fail('uid is required when taskId is provided', 400);

  await runTask(session, {
    uid: actualUid,
    taskId: actualTaskId,
    task,
    reqId,
    devId,
    cmd,
    args,
    type,
    orgId: scope.orgId,
    branchId: scope.branchId,
  });

  return { reqId, taskId: actualTaskId, uid: actualUid };
}

export async function runCommand(session, {
  cmd,
  args = '',
  taskId = null,
  type = 'adhoc',
  devId,
}) {
  if (!devId) fail('devId is required', 400);

  const scp = getScpConfig();
  const reqId = uuidv4();
  const outputFilePath = getCommandOutputPath(reqId, cmd);
  ensureOutputPlaceholder(outputFilePath);

  return createAndRunTask(session, {
    uid: actorUid(session),
    devId,
    task: `Run ${cmd}`,
    reqId,
    cmd: 'cmd',
    args: {
      prog: cmd,
      args,
      srv: scp.host,
      port: scp.port,
      user: scp.user,
      pass: scp.pass,
      file: outputFilePath,
    },
    taskId,
    type,
  });
}

export async function runTemplate(session, {
  devId,
  template,
  taskId = null,
  type = 'adhoc',
}) {
  if (!template) fail('template is required', 400);

  let params;
  try {
    params = { ...(await loadTemplateFile(template)) };
  } catch (err) {
    if (err?.status === 400) throw err;
    fail(`${template} not found`, 404);
  }

  delete params.tvars;
  delete params.title;
  delete params.formValue;

  return createAndRunTask(session, {
    uid: actorUid(session),
    devId,
    task: `Run Template -${template}`,
    reqId: uuidv4(),
    cmd: 'uci',
    args: params,
    taskId,
    type,
  });
}

export async function runUpgrade(session, {
  devId,
  firmware,
  keep = 1,
  force = 0,
  taskId = null,
  type = 'adhoc',
}) {
  const scp = getScpConfig();
  assertScpConfig(scp);
  const model = await resolveDeviceProduct(devId);
  if (!model) fail('Model not found', 404);

  const firmwareName = String(firmware || '').trim();
  if (!firmwareName) fail('firmware is required', 400);

  const firmwarePath = resolveFirmwarePath(model, firmwareName);

  return createAndRunTask(session, {
    uid: actorUid(session),
    devId,
    task: 'Firmware Upgrade',
    reqId: uuidv4(),
    cmd: 'sysup',
    args: {
      srv: scp.host,
      port: scp.port,
      user: scp.user,
      pass: scp.pass,
      firmware: firmwarePath,
      keep: Number(keep) ? 1 : 0,
      force: Number(force) ? 1 : 0,
      stop: ['frr', 'ahhealthcheck', 'ahipsec', 'ahecmp'],
    },
    taskId,
    type,
  });
}

function mqttError(res, err, fallback) {
  const status = err.status || (/not found/i.test(err.message) ? 404 : 500);
  return error(res, err.message || fallback, status);
}

/** POST /api/v1/mqtt/task */
export async function createMqttTask(req, res) {
  try {
    const session = buildSession(req);
    const { task, cmd, args = {}, type = 'adhoc' } = req.body || {};
    const created = await createTask(session, { task, cmd, args, type });
    return success(res, created, 'MQTT task created successfully', 201);
  } catch (err) {
    return mqttError(res, err, 'Failed to create MQTT task');
  }
}

/** POST /api/v1/mqtt/run */
export async function runMqttCommand(req, res) {
  try {
    const session = buildSession(req);
    const { devId, taskId = null, type = 'adhoc', exCom } = req.body || {};
    const selectedCommand = getCommandCatalogEntry(exCom);

    await assertDeviceAccess(devId, session);

    const result = await runCommand(session, {
      cmd: selectedCommand.cmd,
      args: selectedCommand.args,
      taskId,
      type,
      devId,
    });

    return success(
      res,
      {
        taskId: result.taskId,
        reqId: result.reqId,
        uid: result.uid,
        command: {
          key: exCom,
          title: selectedCommand.title,
          cmd: selectedCommand.cmd,
          args: selectedCommand.args,
        },
      },
      'MQTT command published successfully'
    );
  } catch (err) {
    return mqttError(res, err, 'Failed to run MQTT command');
  }
}

/** GET /api/v1/mqtt/commands */
export function listMqttCommands(_req, res) {
  return success(res, { commands: listCommandCatalog() }, 'MQTT commands retrieved successfully');
}

/** GET /api/v1/mqtt/task?name= */
export async function getMqttTaskByName(req, res) {
  try {
    const session = buildSession(req);
    const data = await findTaskByName(req.query.name, session);
    return success(res, data, 'MQTT task lookup completed');
  } catch (err) {
    return mqttError(res, err, 'Failed to lookup MQTT task');
  }
}

/** GET /api/v1/mqtt/tasklog/:reqId */
export async function getMqttTaskStatus(req, res) {
  try {
    const session = buildSession(req);
    const tasklog = await assertTaskLogAccess(await getTaskLogById(req.params.reqId), session);

    return success(
      res,
      {
        reqId: req.params.reqId,
        status: tasklog.status ?? null,
        msg: tasklog.msg ?? '',
        tasklog,
      },
      'MQTT task status retrieved successfully'
    );
  } catch (err) {
    return mqttError(res, err, 'Failed to fetch MQTT task status');
  }
}

/** GET /api/v1/mqtt/output/:reqId */
export async function getMqttTaskOutput(req, res) {
  try {
    const session = buildSession(req);
    const tasklog = await assertTaskLogAccess(await getTaskLogById(req.params.reqId), session);
    const output = await readOutputFile(tasklog.file);

    return success(
      res,
      {
        reqId: req.params.reqId,
        fileName: output.fileName,
        content: output.content,
      },
      'MQTT task output retrieved successfully'
    );
  } catch (err) {
    return mqttError(res, err, 'Failed to fetch MQTT task output');
  }
}
