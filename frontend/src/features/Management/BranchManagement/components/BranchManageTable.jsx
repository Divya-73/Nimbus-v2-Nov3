import React from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';

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

export default function BranchManageTable({
  branches,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onBulkUpload,
  onEdit,
  onDelete,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Branches</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
        <div className="dl-export-actions">
          <button
            type="button"
            className="dl-btn"
            onClick={onBulkUpload}
            disabled={loading}
            title="Bulk upload branches from CSV or Excel"
          >
            <Upload size={14} />
            Bulk upload
          </button>
          <button
            type="button"
            className="dl-btn dl-btn--accent"
            onClick={onCreate}
            disabled={loading}
            title="Create branch"
          >
            <Plus size={14} />
            Create branch
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading branches…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Type</th>
                  <th>Site ID</th>
                  <th>Zone</th>
                  <th>Region</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!branches.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No branches found for this organization</div>
                    </td>
                  </tr>
                ) : (
                  branches.map((b) => {
                    const name = b.branch || '—';
                    return (
                      <tr
                        key={b.id}
                        className="om-row--clickable"
                        onClick={() => onEdit(b)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEdit(b);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        title={`Edit ${name}`}
                      >
                        <td className="dl-table__strong">
                          <span className="om-org-link">{name}</span>
                        </td>
                        <td>{b.branch_type || '—'}</td>
                        <td>
                          <span className="om-code">{b.site_id || '—'}</span>
                        </td>
                        <td>{b.zone || '—'}</td>
                        <td>{b.region || '—'}</td>
                        <td>{b.phone || '—'}</td>
                        <td>{b.email || '—'}</td>
                        <td>{formatEpoch(b.lastupdated || b.datecreated)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="dl-row-actions">
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Edit branch"
                              aria-label={`Edit ${name}`}
                              onClick={() => onEdit(b)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn om-icon-btn--danger"
                              title="Delete branch"
                              aria-label={`Delete ${name}`}
                              onClick={() => onDelete(b)}
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
