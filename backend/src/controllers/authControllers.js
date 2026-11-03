import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeInput } from '../utils/sanitizer.js'; 
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwtUtils.js';
import { success, error } from '../utils/response.js';
import { findUserByEmail, findUserById, incrementTokenVersion } from '../queries/userQueries.js';
import { USER_STATUS } from '../config/databaseConfig.js';
import { insertLoginLog } from '../queries/loginlogQueries.js';
import {
  clearLoginFailures,
  loginCaptchaExtras,
  recordLoginFailure,
} from '../middleware/loginThrottle.js';

// Helper function to format user data (exclude sensitive fields)
function formatUserData(user) {
  return {
    email: user.email,
    firstName: user.firstname || user.firstName || '',
    lastName: user.lastname || user.lastName || '',
    phone: user.phone,
    // Always return role as string, never undefined/null
    role: typeof user.role !== 'undefined' && user.role !== null ? String(user.role) : '',
    orgId: user.orgId || '',
    tags: user.tags || '',
    branchId: user.branchId || '',
    groupKey: user.groupKey || '',
    organization: user.organization || user.orgName || '',
  };
}

function clientIpFromReq(req) {
  return (
    (typeof req.headers['x-forwarded-for'] === 'string' &&
      req.headers['x-forwarded-for'].split(',')[0].trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

/** Fire-and-forget login audit (success or failure). Never throws to caller. */
function writeLoginLog(req, payload = {}) {
  const ip = clientIpFromReq(req);
  insertLoginLog({
    remoteIp: ip,
    clientIp: String(req.headers['http_client_ip'] || req.headers['client-ip'] || ''),
    ForwardedIP: String(req.headers['x-forwarded-for'] || ''),
    source: String(req.headers['sec-ch-ua'] || ''),
    agent: String(req.headers['user-agent'] || ''),
    platForm: String(req.headers['sec-ch-ua-platform'] || ''),
    isMobile: String(req.headers['sec-ch-ua-mobile'] || ''),
    loginTime: Math.floor(Date.now() / 1000),
    username: payload.username || '',
    userId: payload.userId || '',
    sessionId: payload.sessionId || '',
    orgId: payload.orgId || '',
    branchId: payload.branchId || '',
    status: payload.status || 'failed',
    success: payload.status === 'success',
    reason: payload.reason || '',
  }).catch((logErr) => {
    console.warn('Login log write failed:', logErr.message);
  });
}

// Login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Sanitize and normalize email
    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();

    // Find user
    const user = await findUserByEmail(sanitizedEmail);

    if (!user) {
      recordLoginFailure(req);
      writeLoginLog(req, {
        username: sanitizedEmail,
        status: 'failed',
        reason: 'user_not_found',
      });
      return error(res, 'Invalid email or password', 401, loginCaptchaExtras(req));
    }

    if (String(user.active) !== USER_STATUS.ACTIVE) {
      writeLoginLog(req, {
        username: sanitizedEmail,
        userId: user._id || user.id || '',
        orgId: user.orgId || '',
        branchId: user.branchId || '',
        status: 'inactive',
        reason: 'account_inactive',
      });
      return error(res, 'Your account has been deactivated. Please contact support.', 403);
    }

    if (!user.pass) {
      recordLoginFailure(req);
      writeLoginLog(req, {
        username: sanitizedEmail,
        userId: user._id || user.id || '',
        orgId: user.orgId || '',
        branchId: user.branchId || '',
        status: 'failed',
        reason: 'password_missing',
      });
      return error(res, 'Invalid email or password', 401, loginCaptchaExtras(req));
    }

    // Verify password (handle bcrypt $2y$ hash prefix)
    const hashToVerify = user.pass.startsWith('$2y$') 
      ? user.pass.replace(/^\$2y\$/, '$2b$')
      : user.pass;

    const isPasswordValid = await bcrypt.compare(password, hashToVerify);

    if (!isPasswordValid) {
      recordLoginFailure(req);
      writeLoginLog(req, {
        username: sanitizedEmail,
        userId: user._id || user.id || '',
        orgId: user.orgId || '',
        branchId: user.branchId || '',
        status: 'failed',
        reason: 'invalid_password',
      });
      return error(res, 'Invalid email or password', 401, loginCaptchaExtras(req));
    }

    clearLoginFailures(req);

    // Audit log — do not block login response (remote OpenSearch write is slow)
    const sessionId = uuidv4();
    writeLoginLog(req, {
      username: sanitizedEmail,
      userId: user._id || user.id || '',
      orgId: user.orgId || '',
      branchId: user.branchId || '',
      sessionId,
      status: 'success',
      reason: 'login_ok',
    });

    return success(
      res,
      {
        accessToken: generateAccessToken(user),
        refreshToken: generateRefreshToken(user),
        user: formatUserData(user),
      },
      'Login successful'
    );

  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Login error:', err.message);
    }
    const msg =
      err.message === 'Database query failed'
        ? 'Authentication service unavailable. OpenSearch cluster or user index is unhealthy.'
        : 'Login failed. Please try again later.';
    return error(res, msg, err.message === 'Database query failed' ? 503 : 500);
  }
}

// Refresh token
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, 'Refresh token is required', 400);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return error(res, 'Invalid or expired refresh token', 401);
    }

    const user = await findUserById(decoded.userId);

    if (!user) {
      return error(res, 'User not found', 404);
    }

    if (String(user.active) !== USER_STATUS.ACTIVE) {
      return error(res, 'Account is no longer active', 403);
    }

    const userTokenVersion = user.tokenVersion || 0;
    if ((decoded.tokenVersion || 0) !== userTokenVersion) {
      return error(res, 'Token has been revoked. Please login again.', 401);
    }

    return success(res, {
      accessToken: generateAccessToken(user),
      refreshToken: generateRefreshToken(user),
    }, 'Token refreshed successfully');

  } catch (err) {
    return error(res, 'Token refresh failed. Please login again.', 500);
  }
}

// Get profile
export async function profile(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return error(res, 'Invalid token payload', 400);
    }

    const user = await findUserById(userId);

    if (!user) {
      return error(res, 'User not found', 404);
    }

    if (String(user.active) !== USER_STATUS.ACTIVE) {
      return error(res, 'Account is inactive', 403);
    }

    return success(res, { 
      user: formatUserData(user)
    }, 'Profile retrieved successfully');

  } catch (err) {
    return error(res, 'Failed to retrieve profile', 500);
  }
}

// Logout
export async function logout(req, res) {
  try {
    const userId = req.user?.userId;
    
    if (userId) {
      await incrementTokenVersion(userId);
    }
    
    return success(res, {}, 'Logout successful');
    
  } catch (err) {
    return error(res, 'Logout failed', 500);
  }
}
