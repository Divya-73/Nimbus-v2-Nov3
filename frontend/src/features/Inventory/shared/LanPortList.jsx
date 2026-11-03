import React, { useState } from 'react';
import { createPortal } from 'react-dom';

function portStatusKey(status) {
  const key = String(status ?? '')
    .trim()
    .toLowerCase();
  if (key === 'up') return 'up';
  if (key === 'down') return 'down';
  return 'na';
}

function statusLabel(status) {
  if (status === 'up') return 'Up';
  if (status === 'down') return 'Down';
  return 'N/A';
}

function isEmptyMetric(value) {
  const v = String(value ?? '').trim();
  return !v || v === '—' || v === '-' || v === 'n/a' || v === 'N/A';
}

function hoverRows(port) {
  const rows = [
    ['Status', statusLabel(port.status)],
    ['IP', port.ip || '—'],
    ['Latency', port.latency || '—'],
    ['Jitter', port.jitter || '—'],
    ['Packet loss', port.packetLoss || '—'],
  ];
  if (!isEmptyMetric(port.operator)) rows.push(['Operator', port.operator]);
  if (!isEmptyMetric(port.signal)) rows.push(['Signal', port.signal]);
  if (!isEmptyMetric(port.linkStatus)) rows.push(['Link', port.linkStatus]);
  if (port.slot) rows.push(['Slot', port.slot]);
  if (port.op) rows.push(['Service', port.op]);
  if (port.con_id) rows.push(['Service ID', port.con_id]);
  if (!port.op && port.label) rows.push(['Label', port.label]);
  if (port.hint) rows.push(['Note', port.hint]);
  return rows;
}

function IfaceHoverCard({ port, rect }) {
  if (!rect || typeof document === 'undefined') return null;

  const width = 220;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const showAbove = rect.bottom + 160 > window.innerHeight;
  const top = showAbove ? undefined : rect.bottom + 8;
  const bottom = showAbove ? window.innerHeight - rect.top + 8 : undefined;

  return createPortal(
    <div
      className="lp-iface-tip"
      style={{ position: 'fixed', top, bottom, left, width, zIndex: 80 }}
      role="tooltip"
    >
      <strong className="lp-iface-tip__name">{port.label || port.name}</strong>
      {port.label || port.slot ? (
        <span className="lp-iface-tip__assign">
          {[port.name, port.slot].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      <dl className="lp-iface-tip__rows">
        {hoverRows(port).map(([label, value]) => (
          <div key={label} className="lp-iface-tip__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>,
    document.body,
  );
}

export default function LanPortList({ ports, className = '', showIp = false, quiet = false }) {
  const [hover, setHover] = useState(null);

  if (!Array.isArray(ports) || !ports.length) return null;

  const normalized = ports
    .map((port) => ({
      name: String(port?.name || '').trim(),
      status: portStatusKey(port?.status),
      ip: String(port?.ip || '').trim(),
      hint: String(port?.hint || '').trim(),
      slot: String(port?.slot || '').trim(),
      label: String(port?.label || '').trim(),
      op: String(port?.op || '').trim(),
      con_id: String(port?.con_id || '').trim(),
      latency: String(port?.latency || '').trim(),
      jitter: String(port?.jitter || '').trim(),
      packetLoss: String(port?.packetLoss || '').trim(),
      signal: String(port?.signal || '').trim(),
      operator: String(port?.operator || '').trim(),
      linkStatus: String(port?.linkStatus || '').trim(),
    }))
    .filter((port) => port.name);

  if (!normalized.length) return null;

  const hovered = hover ? normalized.find((port) => port.name === hover.name) : null;

  return (
    <ul className={`lan-ports${showIp ? ' lan-ports--ip' : ''}${quiet ? ' lan-ports--quiet' : ''}${className ? ` ${className}` : ''}`}>
      {normalized.map((port) => {
        const assigned = [port.slot, port.label].filter(Boolean).join(' · ');
        const title = port.ip
          ? `${port.name} ${port.status} · ${port.ip}`
          : `${port.name} ${port.status}${showIp ? ' · no IP' : ''}`;
        const fullTitle = [title, assigned, port.hint].filter(Boolean).join(' · ');
        return (
          <li key={port.name} className="lan-ports__item">
            <span
              className={`lan-port-chip lan-port-chip--${port.status}${quiet ? ' lan-port-chip--quiet' : ''}`}
              title={quiet ? undefined : fullTitle}
              onMouseEnter={
                quiet
                  ? (event) => setHover({ name: port.name, rect: event.currentTarget.getBoundingClientRect() })
                  : undefined
              }
              onMouseLeave={quiet ? () => setHover(null) : undefined}
            >
              {quiet ? <span className="lan-port-chip__dot" aria-hidden /> : null}
              <span className="lan-port-chip__text">
                {port.label || port.name}
                {assigned && !port.label ? ` · ${port.slot}` : null}
              </span>
            </span>
            {showIp ? (
              <span className={`lan-ports__ip${port.ip ? '' : ' lan-ports__ip--empty'}`}>
                {port.ip || 'no IP'}
              </span>
            ) : null}
          </li>
        );
      })}
      {quiet && hovered ? <IfaceHoverCard port={hovered} rect={hover.rect} /> : null}
    </ul>
  );
}
