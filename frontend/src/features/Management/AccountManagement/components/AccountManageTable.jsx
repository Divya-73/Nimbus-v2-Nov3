import React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { getRoleLabel } from '../../../../utils/roleManagement';

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

function statusPill(active) {
  const on = String(active) === '1' || String(active).toLowerCase() === 'true';
  return (
    <span className={`dl-pill ${on ? 'dl-pill--up' : 'dl-pill--down'}`}>
      {on ? 'Active' : 'Inactive'}
    </span>
  );
}

function orgLabel(account, orgMap) {
  if (account.orgName || account.organization) return account.orgName || account.organization;
  if (account.orgId && orgMap[account.orgId]) return orgMap[account.orgId];
  return account.orgId || '—';
}

export default function AccountManageTable({
  accounts,
  orgMap = {},
  loading,
  error,
  total,
  page,
  pageSize,
  currentUserId,
  onPageChange,
  onPageSizeChange,
  onCreate,
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
          <h3 className="dash-panel__title">Accounts</h3>
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
            title="Create account"
          >
            <Plus size={14} />
            Create account
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading accounts…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!accounts.length ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="dl-empty">No accounts found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => {
                    const name =
                      [a.firstname, a.lastname].filter(Boolean).join(' ').trim() || '—';
                        const isSelf = currentUserId && a.id === currentUserId;
                    return (
                      <tr key={a.id}>
                        <td className="dl-table__strong">{name}</td>
                        <td>{a.email || '—'}</td>
                        <td>{getRoleLabel(a.role)}</td>
                        <td className="om-cell-clip" title={orgLabel(a, orgMap)}>
                          {orgLabel(a, orgMap)}
                        </td>
                        <td>{a.phone || '—'}</td>
                        <td>{statusPill(a.active)}</td>
                        <td>{formatEpoch(a.lastupdated || a.datecreated)}</td>
                        <td>
                          <div className="dl-row-actions">
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Edit account"
                              aria-label={`Edit ${a.email}`}
                              onClick={() => onEdit(a)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn om-icon-btn--danger"
                              title={
                                isSelf
                                  ? 'You cannot delete your own account'
                                  : 'Delete account'
                              }
                              aria-label={`Delete ${a.email}`}
                              disabled={isSelf}
                              onClick={() => onDelete(a)}
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
