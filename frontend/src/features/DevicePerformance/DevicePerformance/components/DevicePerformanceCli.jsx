import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { createDeviceSshSession, deviceSshWebSocketUrl } from '../../../../api/devices';
import { listDeviceIpv4 } from '../../../Inventory/components/GuiIpPicker';

const TERM_THEMES = {
  light: {
    background: '#f3f5f7',
    foreground: '#12221b',
    cursor: '#0a5b47',
    cursorAccent: '#f3f5f7',
    selectionBackground: 'rgba(10, 91, 71, 0.22)',
  },
  grey: {
    background: '#1c2228',
    foreground: '#e8edf2',
    cursor: '#3dd68c',
    cursorAccent: '#1c2228',
    selectionBackground: 'rgba(61, 214, 140, 0.28)',
  },
  dark: {
    background: '#10151c',
    foreground: '#e8eef4',
    cursor: '#3dd68c',
    cursorAccent: '#10151c',
    selectionBackground: 'rgba(61, 214, 140, 0.28)',
  },
};

export default function DevicePerformanceCli({
  device,
  canManage = false,
  theme = 'light',
  onClose,
}) {
  const ips = useMemo(() => listDeviceIpv4(device), [device]);
  const [ip, setIp] = useState('');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('22');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [error, setError] = useState('');

  const termWrapRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    setIp((current) => (ips.includes(current) ? current : ips[0] || ''));
  }, [ips]);

  function tearDownTerm() {
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    try {
      termRef.current?.dispose();
    } catch {
      /* ignore */
    }
    termRef.current = null;
    fitRef.current = null;
  }

  function disposeSession() {
    tearDownTerm();
    sessionRef.current = null;
    setConnected(false);
    setSessionKey(0);
  }

  useEffect(() => () => disposeSession(), []);

  async function handleConnect(event) {
    event?.preventDefault?.();
    if (!canManage || !device?.id || connecting || connected) return;
    if (!ip) {
      setError('Select a device IPv4 address');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setConnecting(true);
    setError('');
    try {
      const session = await createDeviceSshSession(device.id, {
        ip,
        username,
        password,
        port,
      });
      tearDownTerm();
      sessionRef.current = session;
      setPassword('');
      setSessionKey((value) => value + 1);
      setConnected(true);
    } catch (err) {
      setError(err.message || 'Failed to open CLI');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (!connected || !sessionRef.current || !termWrapRef.current || !sessionKey) {
      return undefined;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: TERM_THEMES[theme] || TERM_THEMES.light,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termWrapRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let ws;
    try {
      ws = new WebSocket(deviceSshWebSocketUrl(sessionRef.current));
    } catch (err) {
      setError(err.message || 'Failed to open CLI WebSocket');
      setConnected(false);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      return undefined;
    }

    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    const endSession = (message = '') => {
      if (message) term.writeln(`\r\n${message}`);
      setConnected(false);
      sessionRef.current = null;
    };

    ws.onopen = () => {
      term.focus();
      requestAnimationFrame(() => fit.fit());
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') term.write(ev.data);
      else term.write(new Uint8Array(ev.data));
    };
    ws.onerror = () => {
      endSession('Connection error.');
    };
    ws.onclose = (ev) => {
      if (ev.code === 1000) {
        endSession('Session closed.');
        return;
      }
      endSession(`Session closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ''}).`);
    };
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      try {
        term.dispose();
      } catch {
        /* ignore */
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [connected, theme, sessionKey]);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = TERM_THEMES[theme] || TERM_THEMES.light;
  }, [theme]);

  useEffect(() => {
    if (!connected) return undefined;
    const onResize = () => fitRef.current?.fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [connected]);

  const statusLabel = connecting ? 'Connecting' : connected ? 'Connected' : 'Idle';

  return (
    <div className="lp-cli" role="region" aria-label="Device CLI">
      <section className="dash-panel dl-table-panel lp-cli-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">CLI</h3>
            <p className="dash-panel__meta">
              SSH into this CPE here. Pick a tab when you want to leave — you will be asked to close CLI first.
            </p>
          </div>
          <div className="lp-cli-head-actions">
            <span className={`lp-cli-status${connected ? ' is-up' : connecting ? ' is-wait' : ''}`}>
              {statusLabel}
            </span>
            {onClose ? (
              <button type="button" className="dl-btn" onClick={onClose}>
                <X size={14} />
                Close CLI
              </button>
            ) : null}
          </div>
        </header>

        {!canManage ? (
          <p className="dl-error">You do not have permission to open device CLI.</p>
        ) : !ips.length ? (
          <p className="dl-error">This device has no IPv4 address for SSH.</p>
        ) : (
          <form className="lp-cli-bar" onSubmit={handleConnect}>
            <label className="dl-field lp-cli-bar__ip">
              <span className="dl-field__label">IPv4</span>
              {ips.length === 1 ? (
                <input value={ip} readOnly />
              ) : (
                <select value={ip} onChange={(e) => setIp(e.target.value)} disabled={connected || connecting}>
                  {ips.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="dl-field">
              <span className="dl-field__label">User</span>
              <input
                value={username}
                autoComplete="username"
                disabled={connected || connecting}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="dl-field lp-cli-bar__port">
              <span className="dl-field__label">Port</span>
              <input
                value={port}
                inputMode="numeric"
                disabled={connected || connecting}
                onChange={(e) => setPort(e.target.value)}
              />
            </label>
            <label className="dl-field lp-cli-bar__pass">
              <span className="dl-field__label">Password</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                disabled={connected || connecting}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {connected ? (
              <button type="button" className="dl-btn" onClick={disposeSession}>
                Disconnect
              </button>
            ) : (
              <button type="submit" className="dl-btn dl-btn--accent" disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            )}
          </form>
        )}

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="lp-cli-dock">
          <div className="lp-cli-dock__label">
            {connected ? `${username}@${ip}:${port}` : 'CLI'}
          </div>
          <div className={`lp-cli-dock__body theme-${theme}`}>
            {!connected ? (
              <p className="lp-cli-placeholder">Connect above to open a shell on this CPE.</p>
            ) : null}
            <div className="lp-cli-term" ref={termWrapRef} />
          </div>
        </div>
      </section>
    </div>
  );
}
