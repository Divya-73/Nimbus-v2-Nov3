import React from 'react';
import { Network, RefreshCw, Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'inactive', label: 'Inactive account' },
];

/** Keep paste/typing friendly while stripping noise around IPs. */
function normalizeIpInput(raw) {
  return String(raw || '')
    .replace(/[,\s]+/g, ' ')
    .replace(/^\s+/, '');
}

function looksLikeIp(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  // Loose IPv4 or IPv6-ish — only for gentle hint, not hard block
  if (/^\d{1,3}(\.\d{1,3}){0,3}\.?$/.test(v)) return true;
  if (/^[0-9a-fA-F:]+$/.test(v) && v.includes(':')) return true;
  return false;
}

export default function LoginLogFilters({
  search,
  username,
  ip,
  status,
  orgId,
  fromDate,
  toDate,
  organizations,
  isSuperAdmin,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const ipTrimmed = String(ip || '').trim();
  const ipHintInvalid = ipTrimmed.length > 0 && !looksLikeIp(ipTrimmed);

  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">Search and filter login audit events</p>
        </div>
        <div className="dl-filters__actions">
          <button type="button" className="dl-btn" onClick={onClear} disabled={loading}>
            Clear
          </button>
          <button
            type="button"
            className="dl-btn dl-btn--accent"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </header>

      <div className="dl-filters__grid">
        <label className="dl-field dl-field--search">
          <span className="dl-field__label">Search</span>
          <span className="dl-field__control">
            <Search size={14} className="dl-field__icon" />
            <input
              type="search"
              value={search}
              onChange={(e) => onChange('search', e.target.value)}
              placeholder="User, agent, reason…"
              aria-label="Search login logs"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => onChange('username', e.target.value)}
            placeholder="e.g. admin@company.com"
            aria-label="Username"
          />
        </label>

        <div className="dl-field">
          <span className="dl-field__label" id="login-log-ip-label">
            IP address
          </span>
          <span className="dl-field__control dl-field__control--clearable">
            <Network size={14} className="dl-field__icon" aria-hidden />
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={ip}
              onChange={(e) => onChange('ip', normalizeIpInput(e.target.value))}
              onBlur={() => {
                if (ip !== ipTrimmed) onChange('ip', ipTrimmed);
              }}
              placeholder="e.g. 203.0.113.45"
              aria-labelledby="login-log-ip-label"
              aria-describedby="login-log-ip-hint"
              aria-invalid={ipHintInvalid}
            />
            {ipTrimmed ? (
              <button
                type="button"
                className="dl-field__clear"
                title="Clear IP"
                aria-label="Clear IP address"
                onClick={() => onChange('ip', '')}
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
          <span
            id="login-log-ip-hint"
            className={`dl-field__hint${ipHintInvalid ? ' dl-field__hint--warn' : ''}`}
          >
            {ipHintInvalid
              ? 'Enter an IPv4 or IPv6 address'
              : 'Matches the client IP on each login'}
          </span>
        </div>

        <label className="dl-field">
          <span className="dl-field__label">Status</span>
          <select
            value={status}
            onChange={(e) => onChange('status', e.target.value)}
            aria-label="Status"
            disabled={loading}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isSuperAdmin ? (
          <label className="dl-field">
            <span className="dl-field__label">Organization</span>
            <select
              value={orgId}
              onChange={(e) => onChange('orgId', e.target.value)}
              aria-label="Organization"
              disabled={loading}
            >
              <option value="">All Organizations</option>
              {(organizations || []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.org_name || o.org || o.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="dl-field">
          <span className="dl-field__label">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onChange('fromDate', e.target.value)}
            aria-label="From date"
            disabled={loading}
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onChange('toDate', e.target.value)}
            aria-label="To date"
            disabled={loading}
          />
        </label>
      </div>
    </section>
  );
}
