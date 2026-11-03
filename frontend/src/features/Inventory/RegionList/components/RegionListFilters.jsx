import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

function zoneOptionValue(z) {
  return typeof z === 'string' ? z : z?.name || '';
}

function zoneOptionLabel(z) {
  if (typeof z === 'string') return z;
  if (!z?.name) return '';
  return z.count != null ? `${z.name} (${z.count})` : z.name;
}

export default function RegionListFilters({
  search,
  orgId,
  zone,
  filterOptions,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const set = (key) => (e) => onChange(key, e.target.value);

  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">Search and narrow regions by organization or zone</p>
        </div>
        <div className="dl-filters__actions">
          <button type="button" className="dl-btn" onClick={onClear} disabled={loading}>
            Clear
          </button>
          <button type="button" className="dl-btn dl-btn--accent" onClick={onRefresh} disabled={loading}>
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
              placeholder="Region name…"
              aria-label="Search regions"
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
          <span className="dl-field__label">Zone</span>
          <select value={zone} onChange={set('zone')} aria-label="Zone">
            <option value="">All Zones</option>
            {(filterOptions.zones || []).map((z) => {
              const value = zoneOptionValue(z);
              if (!value) return null;
              return (
                <option key={value} value={value}>
                  {zoneOptionLabel(z)}
                </option>
              );
            })}
          </select>
        </label>
      </div>
    </section>
  );
}
