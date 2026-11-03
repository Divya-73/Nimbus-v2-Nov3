import { validationError } from '../utils/response.js';
import {
  validateCreateTemplateInput,
  validateUpdateTemplateInput,
  validateMasterTemplateInput,
  validateTemplateIdParam,
} from '../utils/templateValidator.js';

function templateSession(req) {
  const scope = req.scope || {};
  return {
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    orgId: String(scope.orgId || req.user?.orgId || '').trim(),
  };
}

export function validateCreateTemplate(req, res, next) {
  const validation = validateCreateTemplateInput(req.body, templateSession(req));
  if (!validation.isValid) return validationError(res, validation.errors);
  return next();
}

export function validateUpdateTemplate(req, res, next) {
  const validation = validateUpdateTemplateInput(req.body);
  if (!validation.isValid) return validationError(res, validation.errors);
  return next();
}

export function validateMasterTemplate(req, res, next) {
  const validation = validateMasterTemplateInput(req.body, templateSession(req));
  if (!validation.isValid) return validationError(res, validation.errors);
  return next();
}

export function validateTemplateId(req, res, next) {
  const validation = validateTemplateIdParam(req.params.id);
  if (!validation.isValid) return validationError(res, validation.errors);
  return next();
}
