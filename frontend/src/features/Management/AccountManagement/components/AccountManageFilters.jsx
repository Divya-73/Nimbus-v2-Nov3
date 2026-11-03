import React from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { ROLES } from '../../../../utils/roleManagement';

const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.ORG_ADMIN, label: 'Org Admin' },
  { value: ROLES.BRANCH_ADMIN, label: 'Branch Admin' },
  { value: ROLES.VIEWER, label: 'Viewer' },
];

export default function AccountManageFilters({
  search,
  orgId,
  role,
  active,
  organizations,
  isSuperAdmin,
  loading,
  onChange,
  onRefresh,
  onClear,
}) {
  return (
    <section className="dash-panel dl-filters">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Filters</h3>
          <p className="dash-panel__meta">Search and filter user accounts</p>
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
              placeholder="Email, name, phone…"
              aria-label="Search accounts"
            />
          </span>
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
          <span className="dl-field__label">Role</span>
          <select
            value={role}
            onChange={(e) => onChange('role', e.target.value)}
            aria-label="Role"
            disabled={loading}
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.filter((r) => isSuperAdmin || r.value !== ROLES.SUPER_ADMIN).map(
              (r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Status</span>
          <select
            value={active}
            onChange={(e) => onChange('active', e.target.value)}
            aria-label="Status"
            disabled={loading}
          >
            <option value="">All Statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
      </div>
    </section>
  );
}
