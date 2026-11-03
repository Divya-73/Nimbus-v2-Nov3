import React from 'react';
import { Eye, Pencil, Play, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('complete')) return 'up';
  if (value.includes('fail')) return 'down';
  if (value.includes('init')) return 'onboard';
  return '';
}

function artifactLabel(item) {
  return item.act_type === 'config' ? item.t_name || '—' : item.f_name || '—';
}

export default function GroupConfigTable({
  items = [],
  loading,
  error,
  total,
  page,
  pageSize,
  runningId,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onRun,
  onRefresh,
  onEdit,
  onDelete,
  onView,
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Group activities</h3>
          <p className="dash-panel__meta">
            {loading ? 'Loading activities…' : `${total} matching · showing ${from}–${to}`}
          </p>
        </div>
        <div className="dl-export-actions">
          <button type="button" className="dl-btn dl-btn--accent" onClick={onCreate} disabled={loading}>
            <Plus size={14} />
            Add config
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading && !items.length ? (
        <div className="dl-empty">Loading group configs…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table gc-list-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Template / Firmware</th>
                  <th>Total</th>
                  <th>Completed</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!items.length ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="dl-empty">No group configs found</div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const busy = runningId === item.id;
                    const retry = Number(item.runMode) === 1;
                    const tone = statusTone(item.act_status);
                    return (
                      <tr key={item.id}>
                        <td className="dl-table__strong">{item.act_name || '—'}</td>
                        <td>
                          <span className={`tpl-badge tpl-badge--${item.act_type === 'upgrade' ? 'amber' : 'teal'}`}>
                            {item.act_type === 'upgrade' ? 'Upgrade' : 'Config'}
                          </span>
                        </td>
                        <td>
                          <code className="tpl-code">{item.model || '—'}</code>
                        </td>
                        <td className="om-cell-clip" title={artifactLabel(item)}>
                          {artifactLabel(item)}
                        </td>
                        <td>{item.total_dev ?? 0}</td>
                        <td>{item.complete ?? 0}</td>
                        <td>{item.fail ?? 0}</td>
                        <td>{item.pending ?? 0}</td>
                        <td>
                          <span className={`dl-pill${tone ? ` dl-pill--${tone}` : ''}`}>
                            {item.act_status || 'Created'}
                          </span>
                        </td>
                        <td>
                          <div className="dl-row-actions">
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title={retry ? 'Retry failed devices' : 'Run'}
                              aria-label={retry ? 'Retry' : 'Run'}
                              disabled={busy}
                              onClick={() => onRun(item)}
                            >
                              {retry ? <RotateCcw size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Refresh status"
                              aria-label="Refresh status"
                              disabled={busy}
                              onClick={() => onRefresh(item)}
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="View details"
                              aria-label="View details"
                              onClick={() => onView(item)}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() => onEdit(item)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn om-icon-btn--danger"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => onDelete(item)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
