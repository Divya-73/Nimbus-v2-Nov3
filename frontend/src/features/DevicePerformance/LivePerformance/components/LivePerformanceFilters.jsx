import React, { useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';

export default function LivePerformanceFilters({
  search,
  orgId,
  branchId,
  zone,
  region,
  model,
  status,
  sdwanStatus,
  lanStatus,
  lteStatus,
  wanStatus,
  filterOptions,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const set = (key) => (e) => onChange(key, e.target.value);

  const branches = useMemo(() => {
    const all = filterOptions.branches || [];
    if (!orgId) return all;
    return all.filter((b) => !b.orgId || b.orgId === orgId);
  }, [filterOptions.branches, orgId]);

  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">
            Filter assigned devices by location, model, and link / device status
          </p>
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
              onChange={set('search')}
              placeholder="Hostname, model, org…"
              aria-label="Search performance"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Organization</span>
          <select value={orgId} onChange={set('orgId')} aria-label="Organization">
            <option value="">All Organizations</option>
            {(filterOptions.organizations || []).map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Branch</span>
          <select value={branchId} onChange={set('branchId')} aria-label="Branch">
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Zone</span>
          <select value={zone} onChange={set('zone')} aria-label="Zone">
            <option value="">All Zones</option>
            {(filterOptions.zones || []).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Region</span>
          <select value={region} onChange={set('region')} aria-label="Region">
            <option value="">All Regions</option>
            {(filterOptions.regions || []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Model</span>
          <select value={model} onChange={set('model')} aria-label="Model">
            <option value="">All Models</option>
            {(filterOptions.models || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Device Status</span>
          <select value={status} onChange={set('status')} aria-label="Device status">
            <option value="">All</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">SD-WAN</span>
          <select value={sdwanStatus} onChange={set('sdwanStatus')} aria-label="SD-WAN status">
            <option value="">All</option>
            <option value="UP">Up</option>
            <option value="DOWN">Down</option>
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">LAN</span>
          <select value={lanStatus} onChange={set('lanStatus')} aria-label="LAN status">
            <option value="">All</option>
            <option value="UP">Up</option>
            <option value="DOWN">Down</option>
            <option value="NA">N/A</option>
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">WAN</span>
          <select value={wanStatus} onChange={set('wanStatus')} aria-label="WAN status">
            <option value="">All</option>
            <option value="UP">Up</option>
            <option value="DOWN">Down</option>
            <option value="NA">N/A</option>
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">LTE</span>
          <select value={lteStatus} onChange={set('lteStatus')} aria-label="LTE status">
            <option value="">All</option>
            <option value="UP">Up</option>
            <option value="DOWN">Down</option>
            <option value="NA">N/A</option>
          </select>
        </label>
      </div>
    </section>
  );
}
