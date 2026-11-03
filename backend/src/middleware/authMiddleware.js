import { verifyAccessToken } from '../utils/jwtUtils.js';
import { findUserById } from '../queries/userQueries.js';

// Authenticate middleware - verifies JWT token

function normalizeRole(role) {
  const value = String(role || '');
  return {
    value,
    isSuperAdmin: value === 'super_admin' || value === '99',
    isOrgAdmin: value === 'org_admin' || value === '7',
    isBranchAdmin: value === 'branch_admin' || value === '1'
  };
}

function getFirstDefinedValue(sources, keys) {
  for (const source of sources) {                                      
    if (!source) continue;
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === 'undefined' || value === null) continue;
      const str = String(value).trim();
      if (str) return str;
    }
  }
  return '';
}

function setDefaultIfMissing(target, key, value) {
  if (!target || typeof target !== 'object') return;
  if (typeof target[key] === 'undefined' || target[key] === null || String(target[key]).trim() === '') {
    target[key] = value;
  }
}

function enforceScopedIdentifiers(req, res, scope) {
  const requestedOrgId = getFirstDefinedValue([req.params, req.query, req.body], ['orgId', 'orgID', 'organizationId', 'organisationId']);
  const requestedBranchId = getFirstDefinedValue([req.params, req.query, req.body], ['branchId', 'branchID']);

  if (!scope.isSuperAdmin && scope.orgId) {
    if (requestedOrgId && requestedOrgId !== scope.orgId) {
      return res.status(403).json({
        success: false,
        message: 'Org scope violation',
        requestId: req.id
      });
    }
    setDefaultIfMissing(req.query, 'orgId', scope.orgId);
    setDefaultIfMissing(req.body, 'orgId', scope.orgId);
  }

  if (scope.isBranchAdmin && scope.branchId) {
    if (requestedBranchId && requestedBranchId !== scope.branchId) {
      return res.status(403).json({
        success: false,
        message: 'Branch scope violation',
        requestId: req.id
      });
    }
    setDefaultIfMissing(req.query, 'branchId', scope.branchId);
    setDefaultIfMissing(req.body, 'branchId', scope.branchId);
  }

  return null;
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required',
        requestId: req.id
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;

      // Build an authorization/data-scope for the request (so controllers don't need extra orgId/branchId query params)
      let orgId = String(decoded?.orgId || '').trim();
      let branchId = String(decoded?.branchId || '').trim();
      const roleInfo = normalizeRole(decoded?.role);

      if ((!orgId || (roleInfo.isBranchAdmin && !branchId)) && decoded?.userId) {
        try {
          const user = await findUserById(decoded.userId);
          if (user) {
            orgId = orgId || String(user.orgId || '').trim();
            branchId = branchId || String(user.branchId || '').trim();
          }
        } catch (lookupErr) {
        }
      }

      req.scope = {
        role: roleInfo.value,
        orgId,
        branchId,
        isSuperAdmin: roleInfo.isSuperAdmin,
        isOrgAdmin: roleInfo.isOrgAdmin,
        isBranchAdmin: roleInfo.isBranchAdmin
      };

      const violationResponse = enforceScopedIdentifiers(req, res, req.scope);
      if (violationResponse) return;

      // Keep req.user in sync with resolved scope (useful when token didn't include orgId/branchId)
      req.user.orgId = req.scope.orgId;
      req.user.branchId = req.scope.branchId;

      next();
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: err.message || 'Invalid or expired token',
        requestId: req.id
      });
    }
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      requestId: req.id
    });
  }
}

// Authorize middleware - checks user role

export function authorizeRole(...allowedRoles) {
  const allowed = new Set();
  for (const role of allowedRoles) {
    const value = String(role || '').trim();
    if (!value) continue;
    allowed.add(value);
    // Accept both numeric and named forms
    if (value === '99' || value === 'super_admin') {
      allowed.add('99');
      allowed.add('super_admin');
    } else if (value === '7' || value === 'org_admin' || value === 'admin') {
      allowed.add('7');
      allowed.add('org_admin');
      allowed.add('admin');
    } else if (value === '1' || value === 'branch_admin' || value === 'user') {
      allowed.add('1');
      allowed.add('branch_admin');
      allowed.add('user');
    } else if (value === '11' || value === 'viewer') {
      allowed.add('11');
      allowed.add('viewer');
    }
  }

  return (req, res, next) => {
    try {
      if (!req.user || typeof req.user.role === 'undefined') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          requestId: req.id,
        });
      }
      const userRole = String(req.user.role);
      if (!allowed.has(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          requestId: req.id,
        });
      }
      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Authorization failed',
        requestId: req.id,
      });
    }
  };
}
