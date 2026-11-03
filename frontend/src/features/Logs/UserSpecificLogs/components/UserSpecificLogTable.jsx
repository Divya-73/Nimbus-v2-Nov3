import React from 'react';

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

function statusPill(status, statusLabel) {
  const label = statusLabel || '—';
  const s = String(label).toLowerCase();
  if (s === 'success') {
    return <span className="dl-pill dl-pill--up">{label}</span>;
  }
  if (s === 'pending') {
    return <span className="dl-pill dl-pill--partial">{label}</span>;
  }
  if (s === 'failed') {
    return <span className="dl-pill dl-pill--down">{label}</span>;
  }
  return <span className="dl-pill">{label}</span>;
}

export default function UserSpecificLogTable({
  logs,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">User Specific Logs</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading user logs…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Task</th>
                  <th>Type</th>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {!logs.length ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="dl-empty">No user logs found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id || `${row.uid}-${row.created}-${row.no}`}>
                      <td className="dl-table__strong">{formatEpoch(row.created)}</td>
                      <td className="om-cell-clip" title={row.user || row.uid || ''}>
                        {row.user || row.uid || '—'}
                      </td>
                      <td className="dl-cell-wrap" title={row.task || ''}>
                        {row.task || '—'}
                      </td>
                      <td>{row.type || '—'}</td>
                      <td className="om-cell-clip" title={row.hostname || row.devId || ''}>
                        {row.hostname || row.devId || '—'}
                      </td>
                      <td>{statusPill(row.status, row.statusLabel)}</td>
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
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="dl-pagination__btns">
              <button
                type="button"
                className="dl-btn"
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="dl-btn"
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
