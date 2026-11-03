import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { isEmpty, tagList } from '../utils/format';

function val(value) {
  if (isEmpty(value)) return <span className="lp-na">N/A</span>;
  return value;
}

function CopyBtn({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (isEmpty(value)) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="dd-icon-btn"
      onClick={onCopy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Copyable({ value, label }) {
  if (isEmpty(value)) return val(null);
  return (
    <span className="dd-inline">
      {value}
      <CopyBtn value={value} label={label} />
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="lp-kv">
      <span className="lp-kv__label">{label}</span>
      <div className="lp-kv__value">{children}</div>
    </div>
  );
}

function ChipCloud({ items, tone = '' }) {
  if (!items?.length) return <span className="lp-na">N/A</span>;
  return (
    <div className="dd-chip-row">
      {items.map((item) => (
        <span key={item} className={`dd-chip${tone ? ` dd-chip--${tone}` : ''}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function DevicePerformanceGeneral({ device }) {
  if (!device) return null;

  const tags = tagList(device.tags);
  const hasCoords =
    Number.isFinite(Number(device.lat)) && Number.isFinite(Number(device.long));
  const ipv4 = Array.isArray(device.ipv4)
    ? device.ipv4
    : Array.isArray(device.ips)
      ? device.ips.filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip)))
      : [];
  const ips = (Array.isArray(device.ips) && device.ips.length ? device.ips : ipv4)
    .map(String)
    .filter((ip) => ip && ip !== device.guiIp);
  const macs = Array.isArray(device.mac) ? device.mac.slice(0, 8) : [];
  const interfaces = Array.isArray(device.interfaces)
    ? [...new Set(device.interfaces)]
    : [];

  return (
    <section className="lp-sheet">
      <header className="lp-sheet__head">General details</header>
      <div className="lp-sheet__grid">
        <div className="lp-sheet__col">
          <Row label="Org ID">
            <Copyable value={device.orgId} label="org id" />
          </Row>
          <Row label="Branch ID">
            <Copyable value={device.branchId} label="branch id" />
          </Row>
          <Row label="Branch type">{val(device.branchType)}</Row>
          <Row label="Zone">{val(device.zone)}</Row>
          <Row label="Region">{val(device.region)}</Row>
          <Row label="Site ID">{val(device.siteId)}</Row>
          <Row label="NM ID">
            <Copyable value={device.nmId} label="NM id" />
          </Row>
          <Row label="GUI IP">{val(device.guiIp)}</Row>
        </div>
        <div className="lp-sheet__col">
          <Row label="Manufacturer">{val(device.manufacturer)}</Row>
          <Row label="Phone">{val(device.phone)}</Row>
          <Row label="Email">{val(device.email)}</Row>
          <Row label="Website">{val(device.web)}</Row>
          <Row label="Address">{val(device.address)}</Row>
          <Row label="Coordinates">
            {hasCoords ? `${device.lat}, ${device.long}` : val(null)}
          </Row>
          <Row label="Pipeline">{val(device.pipeline)}</Row>
          <Row label="Active">{device.active ? 'Yes' : 'No'}</Row>
        </div>
      </div>

      <div className="lp-sheet__block">
        <Row label="IP addresses">
          <ChipCloud items={ips} tone="info" />
        </Row>
        <Row label="MAC addresses">
          <ChipCloud items={macs} tone="accent" />
        </Row>
        <Row label="Interfaces">
          <ChipCloud items={interfaces} />
        </Row>
        <Row label="Tags">
          <ChipCloud items={tags} tone="info" />
        </Row>
      </div>

      <div className="lp-sheet__times">
        {[
          ['Last boot', device.lastBoot],
          ['Last updated', device.lastUpdated],
          ['Last seen', device.lastSeen],
          ['NM updated', device.nmLastUpdated],
          ['Created', device.dateCreated],
        ].map(([label, value]) => (
          <div key={label} className="lp-sheet__time">
            <span>{label}</span>
            <strong>{isEmpty(value) ? 'N/A' : value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
