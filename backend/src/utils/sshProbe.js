import net from 'net';

export function defaultSshPort() {
  const n = Number(process.env.DEVICE_SSH_PORT);
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : 22;
}

export function defaultSshUser() {
  const v = String(process.env.DEVICE_SSH_USER || 'root').trim();
  return v || 'root';
}

export function probeDeviceSsh(host, port, timeoutMs = Number(process.env.DEVICE_SSH_PROBE_MS) || 3000) {
  const ip = String(host || '').trim();
  const p = Number(port);
  if (!ip || !Number.isFinite(p) || p <= 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    const socket = net.connect({ host: ip, port: p }, () => {
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
