import { validationError } from '../utils/response.js';
import { sanitizeInput } from '../utils/sanitizer.js';
import { GROUP_ACT_TYPE_VALUES, GROUP_ACT_TYPES } from '../config/groupConfigConfig.js';

function fieldError(field, message) {
  return { field, message };
}

function sanitizeIdList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim());
  return [...new Set(list.map((item) => sanitizeInput(item)).filter(Boolean))];
}

export function validateGroupConfigId(req, res, next) {
  const id = sanitizeInput(req.params?.id);
  if (!id) {
    return validationError(res, [fieldError('id', 'id is required')]);
  }
  req.params.id = id;
  return next();
}

export function validateOrgModelQuery(req, res, next) {
  const errors = [];
  const orgId = sanitizeInput(req.query?.orgId || req.body?.orgId);
  const model = sanitizeInput(req.query?.model || req.body?.model);

  if (!orgId) errors.push(fieldError('orgId', 'orgId is required'));
  if (!model) errors.push(fieldError('model', 'model is required'));
  if (errors.length) return validationError(res, errors);

  req.query.orgId = orgId;
  req.query.model = model;
  req.query.selectedIds = sanitizeIdList(req.query?.selectedIds || req.body?.selectedIds);
  if (req.body) {
    req.body.orgId = orgId;
    req.body.model = model;
    req.body.selectedIds = req.query.selectedIds;
  }
  return next();
}

export function validateFirmwareModelQuery(req, res, next) {
  const model = sanitizeInput(req.query?.model || req.body?.model);
  if (!model) {
    return validationError(res, [fieldError('model', 'model is required')]);
  }
  req.query.model = model;
  return next();
}

export function validateCreateGroupConfig(req, res, next) {
  const errors = [];
  const actName = sanitizeInput(req.body?.act_name);
  const actType = sanitizeInput(req.body?.act_type).toLowerCase();
  const orgId = sanitizeInput(req.body?.orgId);
  const model = sanitizeInput(req.body?.model);
  const deviceIds = sanitizeIdList(req.body?.deviceIds);

  if (!actName) errors.push(fieldError('act_name', 'act_name is required'));
  if (!GROUP_ACT_TYPE_VALUES.includes(actType)) {
    errors.push(fieldError('act_type', 'act_type must be config or upgrade'));
  }
  if (!orgId) errors.push(fieldError('orgId', 'orgId is required'));
  if (!model) errors.push(fieldError('model', 'model is required'));
  if (!deviceIds.length) errors.push(fieldError('deviceIds', 'deviceIds is required'));

  if (actType === GROUP_ACT_TYPES.CONFIG) {
    const templateName = sanitizeInput(req.body?.templateName);
    const templateFile = sanitizeInput(req.body?.templateFile);
    if (!templateName) errors.push(fieldError('templateName', 'templateName is required'));
    if (!templateFile) errors.push(fieldError('templateFile', 'templateFile is required'));
    req.body.templateName = templateName;
    req.body.templateFile = templateFile;
  }

  if (actType === GROUP_ACT_TYPES.UPGRADE) {
    const firmware = sanitizeInput(req.body?.firmware);
    if (!firmware) errors.push(fieldError('firmware', 'firmware is required'));
    req.body.firmware = firmware;
  }

  if (errors.length) return validationError(res, errors);

  req.body.act_name = actName;
  req.body.act_type = actType;
  req.body.orgId = orgId;
  req.body.model = model;
  req.body.deviceIds = deviceIds;
  req.body.keep = Boolean(req.body?.keep);
  req.body.force = Boolean(req.body?.force);
  return next();
}

export function validateUpdateGroupConfig(req, res, next) {
  const errors = [];
  const actName = sanitizeInput(req.body?.act_name);
  const deviceIds = sanitizeIdList(req.body?.deviceIds);

  if (!actName) errors.push(fieldError('act_name', 'act_name is required'));
  if (!deviceIds.length) errors.push(fieldError('deviceIds', 'deviceIds is required'));
  if (errors.length) return validationError(res, errors);

  req.body.act_name = actName;
  req.body.deviceIds = deviceIds;
  return next();
}
