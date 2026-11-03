import React from 'react';
import { Monitor, X } from 'lucide-react';

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Deduped IPv4 list from a device row / detail payload. */
export function listDeviceIpv4(device) {
  const raw = Array.isArray(device?.ipv4)
    ? device.ipv4
    : Array.isArray(device?.ips)
      ? device.ips
      : [];
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    const ip = String(value ?? '').trim();
    if (!IPV4_RE.test(ip) || seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }
  return out;
}

/**
 * Modal to pick which device IPv4 to open via GUI proxy.
 */
export default function GuiIpPicker({
  open,
  hostname = 'Device',
  ips = [],
  busy = false,
  error = '',
  onSelect,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-label="Select GUI IP">
      <button type="button" className="dl-gui-modal__backdrop" onClick={onClose} aria-label="Close" />
      <div className="dl-gui-modal__card">
        <header className="dl-gui-modal__head">
          <div>
            <h3 className="dl-gui-modal__title">Select GUI IP</h3>
            <p className="dl-gui-modal__sub">{hostname}</p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close picker">
            <X size={14} />
          </button>
        </header>

        <p className="dl-gui-modal__hint">
          This device has multiple IPv4 addresses. Choose which IP to open.
        </p>

        {error ? <p className="dl-error">{error}</p> : null}

        <ul className="dl-gui-modal__list">
          {ips.map((ip) => (
            <li key={ip}>
              <button
                type="button"
                className="dl-gui-modal__ip"
                disabled={busy}
                onClick={() => onSelect?.(ip)}
              >
                <Monitor size={14} />
                <span>{ip}</span>
                <span className="dl-gui-modal__open">{busy ? 'Opening…' : 'Open'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
