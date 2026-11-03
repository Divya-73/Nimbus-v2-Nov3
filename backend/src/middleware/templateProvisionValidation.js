import { validationError } from '../utils/response.js';
import { sanitizeInput } from '../utils/sanitizer.js';

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

export function validateTemplateProvisionPreview(req, res, next) {
  const deviceIds = sanitizeIdList(req.body?.deviceIds);
  if (!deviceIds.length) {
    return validationError(res, [fieldError('deviceIds', 'deviceIds is required')]);
  }
  req.body = { ...(req.body || {}), deviceIds };
  return next();
}

export function validateTemplateProvisionRun(req, res, next) {
  const errors = [];
  const deviceIds = sanitizeIdList(req.body?.deviceIds);
  const templateId = sanitizeInput(req.body?.templateId);
  const actName = sanitizeInput(req.body?.act_name);

  if (!deviceIds.length) errors.push(fieldError('deviceIds', 'deviceIds is required'));
  if (!templateId) errors.push(fieldError('templateId', 'templateId is required'));
  if (errors.length) return validationError(res, errors);

  req.body = {
    ...(req.body || {}),
    deviceIds,
    templateId,
    act_name: actName,
  };
  return next();
}
