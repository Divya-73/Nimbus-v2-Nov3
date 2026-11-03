import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, Monitor, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import { statusPillClass } from '../../../Inventory/shared/statusHelpers';
import { listDeviceIpv4 } from '../../../Inventory/components/GuiIpPicker';
import { isEmpty, statusLabel } from '../utils/format';

function CopyBtn({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value || value === 'N/A') return null;

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

function displayName(value) {
  if (isEmpty(value) || value === '—') return null;
  return value;
}

function PlaceKpi({ label, name }) {
  const text = displayName(name) || '—';
  return (
    <article className="lp-place">
      <span className="lp-place__label">{label}</span>
      <strong title={text === '—' ? undefined : text}>
        <span className="lp-place__text">{text}</span>
      </strong>
    </article>
  );
}

function sdwanLabel(device) {
  if (device.sdwanStatus && typeof device.sdwanStatus === 'object') {
    return device.sdwanStatus.status;
  }
  return device.sdwanStatus || '—';
}

export default function DevicePerformanceHero({
  device,
  loading,
  refreshing,
  openingGui,
  cliOpen = false,
  backLabel = 'Live Performance',
  canManage = false,
  onBack,
  onRefresh,
  onOpenGui,
  onOpenCli,
  onDelete,
}) {
  if (!device) return null;

  const statusTone = String(device.status || '').toLowerCase();
  const ipv4 = listDeviceIpv4(device);
  const hasGui = ipv4.length > 0;
  const orgTitle = displayName(
    device.orgName && device.orgName !== device.orgId ? device.orgName : null
  ) || displayName(device.org !== device.orgId ? device.org : null);
  const branchTitle = displayName(
    device.branch && device.branch !== device.branchId ? device.branch : null
  );
  const zoneTitle = displayName(device.zone);
  const regionTitle = displayName(device.region);
  const sdwan = String(sdwanLabel(device) || '—').toUpperCase();
  const sdwanUp = sdwan === 'UP';

  return (
    <>
    <section className={`dd-hero lp-hero dd-hero--${statusTone || 'unknown'}`}>
      <div className="dd-hero__top">
        <button type="button" className="dl-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          {backLabel}
        </button>
        <div className="dd-hero__actions">
          <span className={statusPillClass(device.status)}>
            {statusLabel(device.status)}
          </span>
          <button
            type="button"
            className="dl-btn"
            onClick={onRefresh}
            disabled={loading || refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'dd-spin' : undefined} />
            Refresh
          </button>
          <button
            type="button"
            className="dl-btn dl-btn--accent"
            onClick={onOpenGui}
            disabled={!hasGui || openingGui}
            title={
              hasGui
                ? ipv4.length > 1
                  ? `Select from ${ipv4.length} IPv4 addresses`
                  : `GUI via proxy (${ipv4[0]})`
                : 'No IPv4 available for GUI'
            }
          >
            <Monitor size={14} />
            {openingGui ? 'Opening…' : 'Open GUI'}
          </button>
          {canManage ? (
            <button
              type="button"
              className={`dl-btn${cliOpen ? ' dl-btn--accent' : ''}`}
              onClick={onOpenCli}
              disabled={!hasGui}
              title={
                hasGui
                  ? cliOpen
                    ? 'Hide CLI'
                    : 'Open CLI for this CPE'
                  : 'No IPv4 available for CLI'
              }
            >
              <Terminal size={14} />
              {cliOpen ? 'Close CLI' : 'Open CLI'}
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="dl-btn dl-btn--danger lp-hero__delete"
              onClick={onDelete}
              title="Delete this CPE from inventory"
            >
              <Trash2 size={14} />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="dd-hero__body lp-hero__body">
        <div className="dd-hero__identity">
          <h1 className="dd-page-title">{device.hostname}</h1>
          <p className="dd-page-sub">
            {[
              device.model,
              device.version && device.version !== 'N/A' ? device.version : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="dd-hero__meta">
            <span className="dd-meta-id">
              {device.id}
              <CopyBtn value={device.id} label="device id" />
            </span>
          </div>
        </div>

        <div className="lp-hero__facts" aria-label="Device status">
          <div className={`lp-hero__fact${device.isOnline ? ' is-up' : ' is-down'}`}>
            <span>{device.isOnline ? 'Online for' : 'Offline for'}</span>
            <strong>{device.uptime || '—'}</strong>
          </div>
          <div className={`lp-hero__fact${sdwanUp ? ' is-up' : ' is-down'}`}>
            <span>SD-WAN</span>
            <strong>{sdwan}</strong>
          </div>
        </div>
      </div>
    </section>

    <div className="lp-place-grid" aria-label="Organisation placement">
      <PlaceKpi label="Organisation" name={orgTitle} />
      <PlaceKpi label="Branch" name={branchTitle} />
      <PlaceKpi label="Zone" name={zoneTitle} />
      <PlaceKpi label="Region" name={regionTitle} />
    </div>
    </>
  );
}
