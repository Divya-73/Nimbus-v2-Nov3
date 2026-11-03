import http from 'http';
import https from 'https';
import net from 'net';

const DEFAULT_CANDIDATES = [
  { protocol: 'https', port: 443 },
  { protocol: 'https', port: 8443 },
  { protocol: 'http', port: 80 },
  { protocol: 'http', port: 8080 },
];

function parseForcedTarget() {
  const protocol = (process.env.DEVICE_GUI_PROTOCOL || '').toLowerCase();
  const port = Number(process.env.DEVICE_GUI_PORT);
  if ((protocol === 'http' || protocol === 'https') && Number.isFinite(port) && port > 0) {
    return [{ protocol, port }];
  }
  if (protocol === 'http') return [{ protocol: 'http', port: 80 }, { protocol: 'http', port: 8080 }];
  if (protocol === 'https') return [{ protocol: 'https', port: 443 }, { protocol: 'https', port: 8443 }];
  return DEFAULT_CANDIDATES;
}

function tcpReachable(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function httpProbe(host, protocol, port, timeoutMs) {
  return new Promise((resolve) => {
    const transport = protocol === 'http' ? http : https;
    const req = transport.request(
      {
        hostname: host,
        port,
        path: '/',
        method: 'GET',
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          host: host,
          connection: 'close',
          accept: '*/*',
        },
      },
      (res) => {
        res.resume();
        resolve(true);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Find a reachable GUI endpoint on the device from the API host.
 * @returns {Promise<{ protocol: string, port: number } | null>}
 */
export async function probeDeviceGui(guiIp, timeoutMs = Number(process.env.DEVICE_GUI_PROBE_MS) || 2500) {
  const ip = String(guiIp || '').trim();
  if (!ip) return null;

  for (const candidate of parseForcedTarget()) {
    const tcpOk = await tcpReachable(ip, candidate.port, timeoutMs);
    if (!tcpOk) continue;
    const httpOk = await httpProbe(ip, candidate.protocol, candidate.port, timeoutMs);
    if (httpOk) return candidate;
    // TCP open but HTTP failed — still usable for some devices
    return candidate;
  }
  return null;
}
