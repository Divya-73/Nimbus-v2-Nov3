import React from 'react';
import { Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import { branchStatusPillClass } from '../utils/statusHelpers';

export default function BranchListTable({
  branches,
  loading,
  error,
  total,
  page,
  pageSize,
  exporting = false,
  onPageChange,
  onPageSizeChange,
  onView,
  onExportExcel,
  onExportPdf,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canExport = total > 0 && !loading && !exporting;

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Branches</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
            {exporting ? ' · preparing export…' : ''}
          </p>
        </div>
        <div className="dl-export-actions">
          <button
            type="button"
            className="dl-export-btn dl-export-btn--excel"
            onClick={onExportExcel}
            disabled={!canExport}
            title={canExport ? 'Export branches to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="dl-export-btn dl-export-btn--pdf"
            onClick={onExportPdf}
            disabled={!canExport}
            title={canExport ? 'Export branches to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
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
                  <th>Organization</th>
                  <th>Zone</th>
                  <th>Region</th>
                  <th>Devices</th>
                  <th>Up</th>
                  <th>Down</th>
                  <th>Up %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!branches.length ? (
                  <tr>
                    <td colSpan={12}>
                      <div className="dl-empty">No branches found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  branches.map((b) => (
                    <tr key={b.id}>
                      <td className="dl-table__strong">{b.branch}</td>
                      <td>{b.branchType || '—'}</td>
                      <td>{b.siteId || '—'}</td>
                      <td>{b.orgName || '—'}</td>
                      <td>{b.zone || '—'}</td>
                      <td>{b.region || '—'}</td>
                      <td>{b.deviceCount?.total ?? 0}</td>
                      <td>{b.deviceCount?.up ?? 0}</td>
                      <td>{b.deviceCount?.down ?? 0}</td>
                      <td>{b.deviceCount?.upPercentage ?? 0}%</td>
                      <td>
                        <span className={branchStatusPillClass(b.branchStatus)}>
                          {b.branchStatus || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="dl-row-actions">
                          <button
                            type="button"
                            className="dl-icon-btn"
                            title="View branch"
                            aria-label={`View ${b.branch}`}
                            onClick={() => onView(b.id)}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
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
