import { validationError } from '../utils/response.js';
import { sanitizeInput } from '../utils/sanitizer.js';
import { toEpochSeconds } from '../config/deviceStatusConfig.js';

function fieldError(field, message) {
  return { field, message };
}

export function validateDeviceTimeQuery(req, res, next) {
  const errors = [];
  const id = sanitizeInput(req.params?.id);
  if (!id) errors.push(fieldError('id', 'id is required'));
  req.params.id = id;

  const from = sanitizeInput(req.query?.from);
  const to = sanitizeInput(req.query?.to);
  if (from && toEpochSeconds(from) == null) {
    errors.push(fieldError('from', 'from must be a valid timestamp'));
  }
  if (to && toEpochSeconds(to) == null) {
    errors.push(fieldError('to', 'to must be a valid timestamp'));
  }

  req.query.from = from || undefined;
  req.query.to = to || undefined;

  if (errors.length) return validationError(res, errors);
  return next();
}

export const validateDeviceHealthQuery = validateDeviceTimeQuery;
