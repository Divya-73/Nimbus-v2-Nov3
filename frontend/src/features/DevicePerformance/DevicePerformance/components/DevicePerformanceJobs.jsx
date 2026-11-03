import React, { useEffect, useState } from 'react';
import { fetchDeviceJobs } from '../../../../api/performance';

const PAGE_SIZES = [10, 25, 50, 100];
const COL_COUNT = 10;

function formatEpoch(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return value >= 1_000_000_000 ? formatEpoch(value) : String(value);
  }
  const text = String(value);
  if (/^\d{9,}$/.test(text)) return formatEpoch(Number(text));
  return text;
}

function statusPill(label) {
  const s = String(label || '').toLowerCase();
  if (s === 'success') return <span className="dl-pill dl-pill--up">{label}</span>;
  if (s === 'pending') return <span className="dl-pill dl-pill--partial">{label}</span>;
  if (s === 'failed') return <span className="dl-pill dl-pill--down">{label}</span>;
  return <span className="dl-pill">{label || '—'}</span>;
}

function cmdLabel(row) {
  const cmd = String(row.cmd || '').trim();
  const prog = String(row.prog || '').trim();
  if (cmd && prog) return `${cmd} · ${prog}`;
  return cmd || prog || '—';
}

export default function DevicePerformanceJobs({ deviceId, refreshKey }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [deviceId, refreshKey, pageSize, status]);

  useEffect(() => {
    if (!deviceId) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceJobs(deviceId, { page, pageSize, status });
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Failed to load task history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, refreshKey, page, pageSize, status]);

  const jobs = data?.jobs || [];
  const total = Number(data?.total) || 0;
  const hostname = data?.hostname || '';
  const summary = data?.summary || { success: 0, failed: 0, pending: 0 };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="lp-jobs-tab">
      <section className={`dash-panel dl-table-panel${loading ? ' is-loading' : ''}`}>
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Task history</h3>
            <p className="dash-panel__meta">
              {loading
                ? 'Loading…'
                : `${total} matching${hostname ? ` · ${hostname}` : ''}`}
            </p>
          </div>
          <div className="lp-jobs__kpis">
            <span className="dl-pill dl-pill--up">{summary.success} success</span>
            <span className="dl-pill dl-pill--down">{summary.failed} failed</span>
            <span className="dl-pill dl-pill--partial">{summary.pending} pending</span>
            <label className="dl-page-size">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                disabled={loading}
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
        </header>

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="dl-table-scroll">
          <table className="dl-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>User</th>
                <th>Task</th>
                <th>Type</th>
                <th>Cmd</th>
                <th>Sent</th>
                <th>Processed</th>
                <th>Result</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COL_COUNT}>
                    <div className="dl-empty">Loading task history…</div>
                  </td>
                </tr>
              ) : !jobs.length ? (
                <tr>
                  <td colSpan={COL_COUNT}>
                    <div className="dl-empty">
                      No template, reboot, or group actions for this device
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((row) => (
                  <tr key={row.id || `${row.created}-${row.task}`}>
                    <td className="dl-table__strong">{formatEpoch(row.created)}</td>
                    <td className="om-cell-clip" title={row.user || ''}>
                      {row.user || '—'}
                    </td>
                    <td className="om-cell-clip" title={row.task || row.kind || ''}>
                      {row.task || row.kind || '—'}
                    </td>
                    <td>{row.type || '—'}</td>
                    <td className="dl-cell-wrap" title={cmdLabel(row)}>
                      {cmdLabel(row)}
                    </td>
                    <td>{formatEpoch(row.sent)}</td>
                    <td>{formatEpoch(row.process)}</td>
                    <td className="dl-cell-wrap" title={displayValue(row.result)}>
                      {displayValue(row.result)}
                    </td>
                    <td>{statusPill(row.statusLabel)}</td>
                    <td className="dl-cell-wrap">
                      {row.msg || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="dl-pagination">
          <label className="dl-page-size">
            Rows
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              disabled={loading}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <span className="dl-pagination__meta">
            {total === 0 ? '0 tasks' : `${from}–${to} of ${total}`}
          </span>
          <div className="dl-pagination__btns">
            <button
              type="button"
              className="dl-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              type="button"
              className="dl-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
