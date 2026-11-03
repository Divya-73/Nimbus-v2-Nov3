import React from 'react';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';

export default function OnBoardFilters({
  search,
  model,
  models = [],
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const set = (key) => (e) => onChange(key, e.target.value);
  const activeCount = [search, model].filter((v) => String(v || '').trim()).length;

  return (
    <section className="dash-panel dl-filters tpl-filters">
      <header className="dash-panel__head">
        <div className="tpl-section-title">
          <span className="tpl-section-icon" aria-hidden>
            <SlidersHorizontal size={16} />
          </span>
          <div>
            <h3 className="dash-panel__title">Filters</h3>
            <p className="dash-panel__meta">
              {activeCount
                ? `${activeCount} active filter${activeCount === 1 ? '' : 's'}`
                : 'Filter by hostname, model, or IP'}
            </p>
          </div>
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
              placeholder="Hostname, model, IP…"
              aria-label="Search onboard devices"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Model</span>
          <select value={model} onChange={set('model')} aria-label="Model">
            <option value="">All Models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
