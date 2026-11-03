import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

const TIME_RANGE_OPTIONS = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '12h', label: 'Last 12 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

function optionList(values = []) {
  return (values || [])
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
}

export default function AlarmManageFilters({
  search,
  severity,
  state,
  alarmType,
  objectLevel,
  policy,
  tags,
  host,
  siteId,
  org,
  branch,
  timeRange,
  options = {},
  isSuperAdmin,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const severities = optionList(options.severities);
  const states = optionList(options.states);
  const types = optionList(options.types);
  const organizations = optionList(options.organizations);
  const branches = optionList(options.branches);
  const objectLevels = optionList(options.objectLevels);
  const policies = optionList(options.policies);
  const tagOptions = optionList(options.tags);

  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">Filters apply to charts, KPIs, and the alarm table</p>
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
              placeholder="Host, detail, policy, site, device…"
              aria-label="Search alarms"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Severity</span>
          <select value={severity} onChange={(e) => onChange('severity', e.target.value)} disabled={loading}>
            <option value="">All Severities</option>
            {severities.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Status</span>
          <select value={state} onChange={(e) => onChange('state', e.target.value)} disabled={loading}>
            <option value="">All Statuses</option>
            {states.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Alarm type</span>
          <select value={alarmType} onChange={(e) => onChange('alarmType', e.target.value)} disabled={loading}>
            <option value="">All Types</option>
            {types.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Object level</span>
          <select value={objectLevel} onChange={(e) => onChange('objectLevel', e.target.value)} disabled={loading}>
            <option value="">All Levels</option>
            {objectLevels.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Policy</span>
          <select value={policy} onChange={(e) => onChange('policy', e.target.value)} disabled={loading}>
            <option value="">All Policies</option>
            {policies.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Tags</span>
          <select value={tags} onChange={(e) => onChange('tags', e.target.value)} disabled={loading}>
            <option value="">All Tags</option>
            {tagOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Hostname</span>
          <input
            type="text"
            value={host}
            onChange={(e) => onChange('host', e.target.value)}
            placeholder="e.g. SY-…"
            disabled={loading}
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Site ID</span>
          <input
            type="text"
            value={siteId}
            onChange={(e) => onChange('siteId', e.target.value)}
            placeholder="e.g. GUR01"
            disabled={loading}
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Time range</span>
          <select value={timeRange} onChange={(e) => onChange('timeRange', e.target.value)} disabled={loading}>
            {TIME_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {isSuperAdmin ? (
          <label className="dl-field">
            <span className="dl-field__label">Organization</span>
            <select value={org} onChange={(e) => onChange('org', e.target.value)} disabled={loading}>
              <option value="">All Organizations</option>
              {organizations.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="dl-field">
          <span className="dl-field__label">Branch</span>
          <select value={branch} onChange={(e) => onChange('branch', e.target.value)} disabled={loading}>
            <option value="">All Branches</option>
            {branches.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
