import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import { verifySshAccessToken, readSshPassword, clearSshPassword } from '../utils/sshSession.js';

function sendText(ws, text) {
  if (ws.readyState === ws.OPEN) ws.send(String(text));
}

function parseClientMessage(raw) {
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{')) {
      try {
        return JSON.parse(t);
      } catch {
        return { type: 'data', data: raw };
      }
    }
    return { type: 'data', data: raw };
  }
  return { type: 'data', data: raw };
}

function runSshSession(ws, token) {
  let session;
  try {
    session = verifySshAccessToken(token);
  } catch (err) {
    console.warn('[device-ssh] invalid session token:', err?.message || err);
    sendText(ws, '\r\nSSH session expired or invalid.\r\n');
    ws.close();
    return;
  }

  const password = readSshPassword(session.jti);
  if (!password) {
    console.warn('[device-ssh] missing password stash for session', session.jti);
    sendText(ws, '\r\nSSH session expired. Close and connect again.\r\n');
    ws.close();
    return;
  }

  const conn = new Client();
  let stream = null;
  let closed = false;
  let shellOpened = false;

  const shutdown = () => {
    if (closed) return;
    closed = true;
    clearSshPassword(session.jti);
    try {
      stream?.end();
    } catch {
      /* ignore */
    }
    try {
      conn.end();
    } catch {
      /* ignore */
    }
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  };

  ws.on('close', shutdown);
  ws.on('error', shutdown);

  conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
    const answers = (prompts || []).map((prompt) => (
      /password/i.test(String(prompt?.prompt || '')) ? password : ''
    ));
    finish(answers);
  });

  conn.on('ready', () => {
    conn.shell({ term: 'xterm-256color', cols: 120, rows: 32 }, (err, sh) => {
      if (err) {
        console.warn('[device-ssh] shell failed:', session.host, err.message);
        sendText(ws, `\r\nFailed to open shell: ${err.message}\r\n`);
        shutdown();
        return;
      }
      shellOpened = true;
      stream = sh;
      sh.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) ws.send(chunk);
      });
      sh.on('close', () => {
        if (!closed) sendText(ws, '\r\nSSH shell closed.\r\n');
        shutdown();
      });
      sh.stderr?.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) ws.send(chunk);
      });
    });
  });

  conn.on('error', (err) => {
    const msg = String(err?.message || 'SSH connection failed');
    console.warn('[device-ssh] connection error:', session.host, msg);
    sendText(ws, `\r\n${msg}\r\n`);
    shutdown();
  });

  conn.on('close', () => {
    if (!shellOpened && !closed) {
      sendText(ws, '\r\nSSH connection closed before shell opened.\r\n');
    }
    shutdown();
  });

  ws.on('message', (raw) => {
    const msg = parseClientMessage(raw);
    if (msg.type === 'resize' && stream) {
      const cols = Number(msg.cols);
      const rows = Number(msg.rows);
      if (cols > 0 && rows > 0) {
        try {
          stream.setWindow(rows, cols, 0, 0);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (!stream || msg.type !== 'data') return;
    const data = msg.data;
    if (data == null) return;
    try {
      stream.write(data);
    } catch {
      /* ignore */
    }
  });

  console.info('[device-ssh] connecting', {
    host: session.host,
    port: session.port,
    user: session.username,
    deviceId: session.deviceId,
  });

  conn.connect({
    host: session.host,
    port: session.port,
    username: session.username,
    password,
    readyTimeout: Number(process.env.DEVICE_SSH_TIMEOUT_MS) || 12000,
    keepaliveInterval: 15000,
    tryKeyboard: true,
    agent: process.env.SSH_AUTH_SOCK || undefined,
    algorithms: {
      serverHostKey: [
        'ssh-ed25519',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'rsa-sha2-256',
        'rsa-sha2-512',
        'ssh-rsa',
      ],
    },
  });
}

export function attachDeviceSshProxy(server) {
  if (!server) return;
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const rawUrl = String(req.url || '');
    const path = rawUrl.split('?')[0];
    let token = '';
    const match = path.match(/^\/api\/v1\/devices\/ssh-proxy\/([^/]+)$/);
    if (match?.[1]) {
      try {
        token = decodeURIComponent(match[1]);
      } catch {
        token = match[1];
      }
    } else {
      try {
        token = new URL(rawUrl, 'http://localhost').searchParams.get('token') || '';
      } catch {
        token = '';
      }
    }
    if (!token) return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      runSshSession(ws, token);
    });
  });
}
