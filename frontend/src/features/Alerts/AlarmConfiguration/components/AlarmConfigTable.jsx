import React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { enabledRuleCount, formatPolicyTime, toBool } from '../policyForm';

export default function AlarmConfigTable({
  policies = [],
  loading,
  error,
  total,
  page,
  pageSize,
  canManage,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onEdit,
  onDelete,
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Alarm policies</h3>
          <p className="dash-panel__meta">
            {loading ? 'Loading policies…' : `${total} matching · showing ${from}–${to}`}
          </p>
        </div>
        {canManage ? (
          <div className="dl-export-actions">
            <button type="button" className="dl-btn dl-btn--accent" onClick={onCreate} disabled={loading}>
              <Plus size={14} />
              New policy
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading && !policies.length ? (
        <div className="dl-empty">Loading alarm policies…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table ac-list-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Status</th>
                  <th>Devices</th>
                  <th>Rules</th>
                  <th>Created</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {!policies.length ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5}>
                      <div className="dl-empty">No alarm policies found</div>
                    </td>
                  </tr>
                ) : (
                  policies.map((policy) => {
                    const enabled = toBool(policy.enpolicy ?? 1);
                    const devices = Array.isArray(policy.include) ? policy.include.length : 0;
                    return (
                      <tr key={policy.id}>
                        <td className="dl-table__strong">{policy.policy_name || '—'}</td>
                        <td>
                          <span className={`dl-pill ${enabled ? 'dl-pill--up' : 'dl-pill--down'}`}>
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td>{devices}</td>
                        <td>{enabledRuleCount(policy)} / 4</td>
                        <td>{formatPolicyTime(policy.datecreated)}</td>
                        {canManage ? (
                          <td>
                            <div className="dl-row-actions">
                              <button
                                type="button"
                                className="dl-icon-btn"
                                title="Edit"
                                aria-label={`Edit ${policy.policy_name || 'policy'}`}
                                onClick={() => onEdit(policy)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="dl-icon-btn om-icon-btn--danger"
                                title="Delete"
                                aria-label={`Delete ${policy.policy_name || 'policy'}`}
                                onClick={() => onDelete(policy)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        ) : null}
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
