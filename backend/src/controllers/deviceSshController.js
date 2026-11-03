import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceGuiAccess, resolveGuiIp } from '../queries/deviceGuiQueries.js';
import { createSshAccessToken, stashSshPassword, sshSessionTtlSeconds } from '../utils/sshSession.js';
import { defaultSshPort, defaultSshUser, probeDeviceSsh } from '../utils/sshProbe.js';

function buildSession(req) {
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(req.scope?.isSuperAdmin),
    isOrgAdmin: Boolean(req.scope?.isOrgAdmin),
    isBranchAdmin: Boolean(req.scope?.isBranchAdmin),
    role: String(req.user?.role || req.scope?.role || '').trim(),
  };
}

function assertCanSsh(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '99' || role === '7' || role === '1') return;
  const err = new Error('You do not have permission to open device SSH');
  err.status = 403;
  throw err;
}

function cleanUsername(value) {
  const v = String(value || '').trim();
  if (!v) return defaultSshUser();
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(v)) {
    const err = new Error('Invalid SSH username');
    err.status = 400;
    throw err;
  }
  return v;
}

function cleanPort(value) {
  if (value == null || value === '') return defaultSshPort();
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    const err = new Error('Invalid SSH port');
    err.status = 400;
    throw err;
  }
  return n;
}

/**
 * POST /api/v1/devices/:id/ssh-session
 * Body: { ip?, username?, password, port? }
 */
export async function createDeviceSshSession(req, res) {
  try {
    const session = buildSession(req);
    assertCanSsh(session);

    const deviceId = req.params?.id;
    const device = await getDeviceGuiAccess(deviceId, session);

    let host = '';
    try {
      host = resolveGuiIp(device.ips, req.body?.ip ?? req.body?.host);
    } catch (pickErr) {
      return error(res, pickErr.message || 'Invalid SSH IP', 400);
    }
    if (!host) {
      return error(res, 'Device has no IPv4 address for SSH', 400);
    }

    const password = String(req.body?.password ?? '');
    if (!password) {
      return error(res, 'SSH password is required', 400);
    }
    if (password.length > 256) {
      return error(res, 'SSH password is too long', 400);
    }

    const username = cleanUsername(req.body?.username);
    const port = cleanPort(req.body?.port);

    const skipProbe = String(process.env.DEVICE_SSH_SKIP_PROBE || '').toLowerCase() === 'true';
    if (!skipProbe) {
      const reachable = await probeDeviceSsh(host, port);
      if (!reachable) {
        return error(
          res,
          `API host cannot reach SSH at ${host}:${port}. ` +
            'Run the backend on a host that can route to the device, or join the same network/VPN.',
          502
        );
      }
    }

    const { token, jti, ttl } = createSshAccessToken({
      deviceId: device.id || deviceId,
      host,
      port,
      username,
      userId: req.user?.userId || req.user?.id || '',
    });
    stashSshPassword(jti, password, ttl);

    const wsPath = `/api/v1/devices/ssh-proxy/${encodeURIComponent(token)}`;
    return success(
      res,
      {
        token,
        wsPath,
        host,
        port,
        username,
        ipv4: device.ipv4 || [],
        deviceId: device.id || deviceId,
        hostname: device.hostname,
        expiresIn: ttl,
      },
      'Device SSH session created'
    );
  } catch (err) {
    const msg = err.message || 'Failed to create SSH session';
    const status = err.status || (/not found/i.test(msg) ? 404 : /permission/i.test(msg) ? 403 : 500);
    return error(res, msg, status);
  }
}
