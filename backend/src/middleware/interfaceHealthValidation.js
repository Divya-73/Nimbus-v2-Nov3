import { sanitizeInput } from '../utils/sanitizer.js';

export function validateInterfaceHealthQuery(req, res, next) {
  const raw = req.query?.iface;
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '').split(',').map((item) => item.trim());
  const ifaces = [...new Set(list.map((item) => sanitizeInput(item)).filter(Boolean))];
  req.query.iface = ifaces.length ? ifaces : undefined;
  return next();
}
