import { validationError } from '../utils/response.js';

function fieldError(field, message) {
  return { field, message };
}

export function validateDataUsageQuery(req, res, next) {
  const raw = req.query?.point;
  if (raw == null || String(raw).trim() === '') {
    req.query.point = undefined;
    return next();
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 5000) {
    return validationError(res, [fieldError('point', 'point must be between 1 and 5000')]);
  }

  req.query.point = String(Math.floor(n));
  return next();
}
