import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

export default function UserSpecificLogFilters({
  search,
  task,
  devId,
  type,
  status,
  uid,
  fromDate,
  toDate,
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
          <p className="dash-panel__meta">Search and filter user task activity</p>
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
              placeholder="Task, device, message…"
              aria-label="Search user logs"
            />
          </span>
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Task</span>
          <input
            type="text"
            value={task}
            onChange={(e) => onChange('task', e.target.value)}
            placeholder="e.g. Run dmesg"
            aria-label="Task"
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Device ID</span>
          <input
            type="text"
            value={devId}
            onChange={(e) => onChange('devId', e.target.value)}
            placeholder="Device id"
            aria-label="Device ID"
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Type</span>
          <input
            type="text"
            value={type}
            onChange={(e) => onChange('type', e.target.value)}
            placeholder="e.g. adhoc"
            aria-label="Type"
          />
        </label>

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
            <span className="dl-field__label">User ID</span>
            <input
              type="text"
              value={uid}
              onChange={(e) => onChange('uid', e.target.value)}
              placeholder="Filter by user uid"
              aria-label="User ID"
            />
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
