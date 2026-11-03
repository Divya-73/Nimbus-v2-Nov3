import { validationError } from '../utils/response.js';
import { getCommandCatalogEntry } from '../config/mqttConfig.js';
import { sanitizeInput } from '../utils/sanitizer.js';

function fieldError(field, message) {
  return { field, message };
}

export function validateCreateMqttTask(req, res, next) {
  const errors = [];
  const task = sanitizeInput(req.body?.task);
  const cmd = sanitizeInput(req.body?.cmd);
  if (!task) errors.push(fieldError('task', 'task is required'));
  if (!cmd) errors.push(fieldError('cmd', 'cmd is required'));
  if (errors.length) return validationError(res, errors);

  req.body.task = task;
  req.body.cmd = cmd;
  req.body.type = sanitizeInput(req.body?.type) || 'adhoc';
  return next();
}

export function validateRunMqttCommand(req, res, next) {
  const errors = [];
  const devId = sanitizeInput(req.body?.devId);
  const exCom = sanitizeInput(req.body?.exCom).toLowerCase();

  if (!devId) errors.push(fieldError('devId', 'devId is required'));
  if (!exCom) errors.push(fieldError('exCom', 'exCom is required'));
  if (exCom && !getCommandCatalogEntry(exCom)) {
    errors.push(fieldError('exCom', 'Unsupported command'));
  }
  if (errors.length) return validationError(res, errors);

  req.body.devId = devId;
  req.body.exCom = exCom;
  req.body.type = sanitizeInput(req.body?.type) || 'adhoc';
  req.body.taskId = sanitizeInput(req.body?.taskId) || null;
  return next();
}

export function validateMqttReqId(req, res, next) {
  const reqId = sanitizeInput(req.params?.reqId);
  if (!reqId) {
    return validationError(res, [fieldError('reqId', 'reqId is required')]);
  }
  req.params.reqId = reqId;
  return next();
}

export function validateMqttTaskName(req, res, next) {
  const name = sanitizeInput(req.query?.name);
  if (!name) {
    return validationError(res, [fieldError('name', 'name is required')]);
  }
  req.query.name = name;
  return next();
}
