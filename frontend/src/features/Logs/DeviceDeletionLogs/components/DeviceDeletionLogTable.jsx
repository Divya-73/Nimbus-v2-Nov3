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

export default function DeviceDeletionLogTable({
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
          <h3 className="dash-panel__title">Device Deletion Logs</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading device deletion logs…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Username</th>
                  <th>Hostname</th>
                  <th>Org</th>
                  <th>Branch</th>
                  <th>Model</th>
                  <th>Source</th>
                  <th>Session ID</th>
                  <th>User ID</th>
                </tr>
              </thead>
              <tbody>
                {!logs.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No deletion logs found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id || `${row.username}-${row.deletedTime}-${row.no}`}>
                      <td className="dl-table__strong">{formatEpoch(row.deletedTime)}</td>
                      <td>{row.username || '—'}</td>
                      <td className="om-cell-clip" title={row.sysname || ''}>
                        {row.sysname || '—'}
                      </td>
                      <td className="om-cell-clip" title={row.org || ''}>
                        {row.org || '—'}
                      </td>
                      <td className="om-cell-clip" title={row.branch || ''}>
                        {row.branch || '—'}
                      </td>
                      <td>{row.model || '—'}</td>
                      <td>{row.onboard ? 'On Board' : 'Device Performance'}</td>
                      <td className="dl-cell-wrap">
                        {row.sessionId || '—'}
                      </td>
                      <td className="om-cell-clip" title={row.userId || ''}>
                        {row.userId || '—'}
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
