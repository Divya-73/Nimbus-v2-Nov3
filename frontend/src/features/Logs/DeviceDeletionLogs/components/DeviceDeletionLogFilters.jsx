import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

export default function DeviceDeletionLogFilters({
  search,
  username,
  sysname,
  sessionId,
  userId,
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
          <p className="dash-panel__meta">Search and filter device deletion events</p>
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
              placeholder="User, hostname, session…"
              aria-label="Search device deletion logs"
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
            disabled={loading}
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Hostname</span>
          <input
            type="text"
            value={sysname}
            onChange={(e) => onChange('sysname', e.target.value)}
            placeholder="e.g. SY-…"
            aria-label="Hostname"
            disabled={loading}
          />
        </label>

        <label className="dl-field">
          <span className="dl-field__label">Session ID</span>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => onChange('sessionId', e.target.value)}
            placeholder="Session id"
            aria-label="Session ID"
            disabled={loading}
          />
        </label>

        {isSuperAdmin ? (
          <label className="dl-field">
            <span className="dl-field__label">User ID</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => onChange('userId', e.target.value)}
              placeholder="User id"
              aria-label="User ID"
              disabled={loading}
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
