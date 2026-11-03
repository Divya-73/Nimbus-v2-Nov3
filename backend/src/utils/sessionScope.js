/**
 * Build OpenSearch session scope from auth middleware `req.scope`.
 * Super admin → no org/branch filter.
 * Org admin → org only.
 * Branch admin / others → org + branch when set.
 * Optional UI filters: zone, region, tags (from query).
 */
export function sessionFromReq(req) {
  const scope = req.scope || {};
  const optional = pickOptionalFilters(req);

  if (scope.isSuperAdmin) {
    return optional;
  }

  const session = { ...optional };
  if (scope.orgId) session.orgId = scope.orgId;
  if (scope.branchId && !scope.isOrgAdmin) session.branchId = scope.branchId;
  return session;
}

function pickOptionalFilters(req) {
  const out = {};
  for (const key of ['zone', 'region', 'tags']) {
    const v = req.query?.[key];
    if (v != null && String(v).trim() !== '') out[key] = String(v).trim();
  }
  return out;
}
