import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { getDeviceGuiAccess, resolveGuiIp } from '../queries/deviceGuiQueries.js';
import { createGuiAccessToken, guiSessionTtlSeconds } from '../utils/guiSession.js';
import { probeDeviceGui } from '../utils/guiProbe.js';

/**
 * POST /api/v1/devices/:id/gui-session
 * Body optional: { ip } — selected IPv4 when device has multiple addresses.
 * Probes reachability from the API host, then mints a short-lived proxy token.
 */
export async function createDeviceGuiSession(req, res) {
  try {
    const session = sessionFromReq(req);
    const deviceId = req.params?.id;
    const device = await getDeviceGuiAccess(deviceId, session);

    let guiIp = '';
    try {
      guiIp = resolveGuiIp(device.ips, req.body?.ip ?? req.body?.guiIp);
    } catch (pickErr) {
      return error(res, pickErr.message || 'Invalid GUI IP', 400);
    }

    if (!guiIp) {
      return error(res, 'Device has no IPv4 address for GUI', 400);
    }

    const skipProbe = String(process.env.DEVICE_GUI_SKIP_PROBE || '').toLowerCase() === 'true';
    let target = null;

    if (skipProbe) {
      const protocol = (process.env.DEVICE_GUI_PROTOCOL || 'https').toLowerCase() === 'http' ? 'http' : 'https';
      const port = Number(process.env.DEVICE_GUI_PORT) || (protocol === 'http' ? 80 : 443);
      target = { protocol, port };
    } else {
      target = await probeDeviceGui(guiIp);
    }

    if (!target) {
      return error(
        res,
        `API host cannot reach device GUI at ${guiIp} (tried HTTPS 443/8443 and HTTP 80/8080). ` +
          'Run the backend on a host that can route to the device (SD-WAN / management path), ' +
          'or join the same network/VPN as the device.',
        502
      );
    }

    const userId = req.user?.userId || req.user?.id || '';
    const token = createGuiAccessToken({
      deviceId: device.id || deviceId,
      guiIp,
      userId,
      protocol: target.protocol,
      port: target.port,
    });

    const ttl = guiSessionTtlSeconds();
    const proxyPath = `/api/v1/devices/gui-proxy/${encodeURIComponent(token)}/`;

    return success(
      res,
      {
        token,
        proxyPath,
        guiIp,
        ipv4: device.ipv4 || [],
        protocol: target.protocol,
        port: target.port,
        deviceId: device.id || deviceId,
        hostname: device.hostname,
        expiresIn: ttl,
      },
      'Device GUI session created'
    );
  } catch (err) {
    const msg = err.message || 'Failed to create GUI session';
    const status = /not found/i.test(msg) ? 404 : 500;
    return error(res, msg, status);
  }
}
