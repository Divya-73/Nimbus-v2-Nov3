import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

function optionName(item) {
  if (typeof item === 'string') return item;
  return item?.name || '';
}

export default function BranchManageFilters({
  search,
  zone,
  region,
  filterOptions,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const zones = filterOptions?.zones || [];
  const regions = filterOptions?.regions || [];

  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">Search branches by name, site, zone, region, or contact</p>
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
              placeholder="Branch, site, outlet, email…"
              aria-label="Search branches"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Zone</span>
          <select
            value={zone}
            onChange={(e) => onChange('zone', e.target.value)}
            aria-label="Zone"
            disabled={loading}
          >
            <option value="">All Zones</option>
            {zones.map((z) => {
              const name = optionName(z);
              if (!name) return null;
              const count = typeof z === 'object' && z?.count != null ? z.count : null;
              return (
                <option key={name} value={name}>
                  {count != null ? `${name} (${count})` : name}
                </option>
              );
            })}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Region</span>
          <select
            value={region}
            onChange={(e) => onChange('region', e.target.value)}
            aria-label="Region"
            disabled={loading}
          >
            <option value="">All Regions</option>
            {regions.map((r) => {
              const name = optionName(r);
              if (!name) return null;
              const count = typeof r === 'object' && r?.count != null ? r.count : null;
              return (
                <option key={name} value={name}>
                  {count != null ? `${name} (${count})` : name}
                </option>
              );
            })}
          </select>
        </label>
      </div>
    </section>
  );
}
