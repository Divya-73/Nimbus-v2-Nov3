import React from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { statusPillClass } from '../../../Inventory/shared/statusHelpers';

const PAGE_SIZES = [10, 25, 50, 100];

function formatIps(device) {
  const list = Array.isArray(device?.ipv4) && device.ipv4.length
    ? device.ipv4
    : Array.isArray(device?.ips)
      ? device.ips
      : [];
  if (!list.length) return '—';
  if (list.length === 1) return list[0];
  return `${list[0]} +${list.length - 1}`;
}

export default function OnBoardTable({
  devices,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  canManage,
  onAssign,
  onDelete,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Onboard devices</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
          </p>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading onboard devices…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Model</th>
                  <th>Version</th>
                  <th>IP</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Created</th>
                  {canManage ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {!devices.length ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7}>
                      <div className="dl-empty">
                        No unassigned devices found
                      </div>
                    </td>
                  </tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.id}>
                      <td className="dl-table__strong">{d.hostname}</td>
                      <td>{d.model || '—'}</td>
                      <td>{d.version || '—'}</td>
                      <td title={(d.ipv4 || d.ips || []).join(', ')}>{formatIps(d)}</td>
                      <td>
                        <span className={statusPillClass('onboard')}>Onboard</span>
                      </td>
                      <td>{d.lastSeen || '—'}</td>
                      <td>{d.dateCreated || '—'}</td>
                      {canManage ? (
                        <td>
                          <div className="ob-row-actions">
                            <button
                              type="button"
                              className="dl-icon-btn"
                              title="Assign"
                              aria-label={`Assign ${d.hostname}`}
                              onClick={() => onAssign(d)}
                            >
                              <UserPlus size={14} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon-btn om-icon-btn--danger"
                              title="Delete"
                              aria-label={`Delete ${d.hostname}`}
                              onClick={() => onDelete(d)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      ) : null}
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
                {PAGE_SIZES.map((n) => (
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
                Previous
              </button>
              <span className="dl-pagination__page">
                {page} / {totalPages}
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
