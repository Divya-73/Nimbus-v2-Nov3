import React from 'react';
import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';

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

function webHref(web) {
  const raw = String(web || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function OrgManageTable({
  orgs,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onOpenBranches,
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
          <h3 className="dash-panel__title">Organizations</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
        <div className="dl-export-actions">
          <button
            type="button"
            className="dl-btn dl-btn--accent"
            onClick={onCreate}
            disabled={loading}
            title="Create organization"
          >
            <Plus size={14} />
            Create organization
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading organizations…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Code</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Website</th>
                  <th>Address</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!orgs.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No organizations found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  orgs.map((o) => {
                    const name = o.org_name || o.org || '—';
                    const href = webHref(o.web);
                    const openBranches = () => onOpenBranches?.(o);
                    return (
                      <tr
                        key={o.id}
                        className={onOpenBranches ? 'om-row--clickable' : undefined}
                        onClick={onOpenBranches ? openBranches : undefined}
                        onKeyDown={
                          onOpenBranches
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openBranches();
                                }
                              }
                            : undefined
                        }
                        tabIndex={onOpenBranches ? 0 : undefined}
                        role={onOpenBranches ? 'link' : undefined}
                        title={onOpenBranches ? `Manage branches for ${name}` : undefined}
                      >
                        <td className="dl-table__strong">
                          <span className="om-org-link">{name}</span>
                        </td>
                        <td>
                          <span className="om-code">{o.org || '—'}</span>
                        </td>
                        <td>{o.email || '—'}</td>
                        <td>{o.phone || '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {href ? (
                            <a
                              className="om-link"
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={href}
                            >
                              {o.web}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="om-cell-clip" title={o.address || ''}>
                          {o.address || '—'}
                        </td>
                        <td>{formatEpoch(o.datecreated)}</td>
                        <td>{formatEpoch(o.lastupdated)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="dl-row-actions">
                            {onOpenBranches ? (
                              <button
                                type="button"
                                className="dl-btn om-branches-btn"
                                title="Manage branches"
                                aria-label={`Manage branches for ${name}`}
                                onClick={openBranches}
                              >
                                <GitBranch size={14} />
                                Branches
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Edit organization"
                              aria-label={`Edit ${name}`}
                              onClick={() => onEdit(o)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn om-icon-btn--danger"
                              title="Delete organization"
                              aria-label={`Delete ${name}`}
                              onClick={() => onDelete(o)}
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
