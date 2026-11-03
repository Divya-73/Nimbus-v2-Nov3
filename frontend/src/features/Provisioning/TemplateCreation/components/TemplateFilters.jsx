import React, { useMemo } from 'react';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { TEMPLATE_TYPES } from '../utils/templateOptions';

export default function TemplateFilters({
  search,
  orgId,
  model,
  type,
  organizations = [],
  models = [],
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  const orgOptions = useMemo(
    () =>
      organizations.map((org) => ({
        value: org.id || org.org || '',
        label: org.name || org.org_name || org.org || org.id || 'Organization',
      })),
    [organizations]
  );

  const activeCount = [orgId, model, type, search].filter((v) => String(v || '').trim()).length;

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
              {activeCount ? `${activeCount} active filter${activeCount === 1 ? '' : 's'}` : 'Refine the template catalog'}
            </p>
          </div>
        </div>
        <div className="dl-filters__actions">
          <button type="button" className="dl-btn" onClick={onClear} disabled={loading || !activeCount}>
            Clear
          </button>
          <button type="button" className="dl-btn dl-btn--accent" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'tpl-spin' : undefined} />
            Refresh
          </button>
        </div>
      </header>

      <div className="dl-filters__grid tpl-filters-grid">
        <label className="dl-field">
          <span className="dl-field__label">Organization</span>
          <select value={orgId} onChange={(e) => onChange('orgId', e.target.value)} disabled={loading}>
            <option value="">All organizations</option>
            {orgOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Model</span>
          <select value={model} onChange={(e) => onChange('model', e.target.value)} disabled={loading}>
            <option value="">All models</option>
            {models.map((m) => {
              const value = typeof m === 'string' ? m : m.model || m.name || m.id || '';
              const label = typeof m === 'string' ? m : m.model || m.name || value;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Type</span>
          <select value={type} onChange={(e) => onChange('type', e.target.value)} disabled={loading}>
            <option value="">All types</option>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label || t.title}
              </option>
            ))}
          </select>
        </label>

        <label className="dl-field dl-field--search">
          <span className="dl-field__label">Search</span>
          <span className="dl-field__control">
            <Search size={14} className="dl-field__icon" />
            <input
              type="search"
              value={search}
              onChange={(e) => onChange('search', e.target.value)}
              placeholder="Search by template name…"
              aria-label="Search templates"
            />
          </span>
        </label>
      </div>
    </section>
  );
}
