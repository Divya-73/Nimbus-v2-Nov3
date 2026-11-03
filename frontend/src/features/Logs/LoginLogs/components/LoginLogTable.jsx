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

function statusPill(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') {
    return <span className="dl-pill dl-pill--up">Success</span>;
  }
  if (s === 'inactive') {
    return <span className="dl-pill dl-pill--partial">Inactive</span>;
  }
  if (s === 'failed') {
    return <span className="dl-pill dl-pill--down">Failed</span>;
  }
  return <span className="dl-pill">{status || '—'}</span>;
}

function orgLabel(row, orgMap) {
  if (row.orgId && orgMap[row.orgId]) return orgMap[row.orgId];
  return row.orgId || '—';
}

function reasonLabel(reason) {
  const map = {
    login_ok: 'Login OK',
    user_not_found: 'User not found',
    invalid_password: 'Invalid password',
    account_inactive: 'Account inactive',
    password_missing: 'Password missing',
  };
  const key = String(reason || '').trim();
  if (!key) return '—';
  return map[key] || key;
}

export default function LoginLogTable({
  logs,
  orgMap = {},
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
          <h3 className="dash-panel__title">Login Logs</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading login logs…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>IP</th>
                  <th>Organization</th>
                  <th>Platform</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {!logs.length ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="dl-empty">No login logs found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id || `${row.username}-${row.loginTime}-${row.no}`}>
                      <td className="dl-table__strong">{formatEpoch(row.loginTime)}</td>
                      <td>{row.username || '—'}</td>
                      <td>{statusPill(row.status)}</td>
                      <td className="om-cell-clip" title={reasonLabel(row.reason)}>
                        {reasonLabel(row.reason)}
                      </td>
                      <td className="om-cell-clip" title={row.remoteIp || row.clientIp || ''}>
                        {row.remoteIp || row.clientIp || '—'}
                      </td>
                      <td className="om-cell-clip" title={orgLabel(row, orgMap)}>
                        {orgLabel(row, orgMap)}
                      </td>
                      <td className="om-cell-clip" title={row.platForm || ''}>
                        {row.platForm || '—'}
                      </td>
                      <td className="dl-cell-wrap">
                        {row.agent || '—'}
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
