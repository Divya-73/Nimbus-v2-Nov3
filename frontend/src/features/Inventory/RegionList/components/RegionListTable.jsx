import React from 'react';
import { Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import { regionStatusPillClass } from '../utils/statusHelpers';

/** One name → show the name; many → "Name +N"; none → count or em dash. */
function formatNameList(names, count) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  if (list.length === 1) return list[0];
  if (list.length > 1) return `${list[0]} +${list.length - 1}`;
  const n = count ?? 0;
  return n > 0 ? String(n) : '—';
}

export default function RegionListTable({
  regions,
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
          <h3 className="dash-panel__title">Regions</h3>
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
            title={canExport ? 'Export regions to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="dl-export-btn dl-export-btn--pdf"
            onClick={onExportPdf}
            disabled={!canExport}
            title={canExport ? 'Export regions to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading regions…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Organizations</th>
                  <th>Zones</th>
                  <th>Devices</th>
                  <th>Up</th>
                  <th>Down</th>
                  <th>Up %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!regions.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No regions found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  regions.map((r) => (
                    <tr key={r.id || r.region}>
                      <td className="dl-table__strong">{r.region}</td>
                      <td title={(r.orgNames || []).join(', ')}>
                        {formatNameList(r.orgNames, r.orgCount)}
                      </td>
                      <td title={(r.zones || []).join(', ')}>
                        {formatNameList(r.zones, r.zoneCount)}
                      </td>
                      <td>{r.deviceCount?.total ?? 0}</td>
                      <td>{r.deviceCount?.up ?? 0}</td>
                      <td>{r.deviceCount?.down ?? 0}</td>
                      <td>{r.deviceCount?.upPercentage ?? 0}%</td>
                      <td>
                        <span className={regionStatusPillClass(r.status)}>{r.status || '—'}</span>
                      </td>
                      <td>
                        <div className="dl-row-actions">
                          <button
                            type="button"
                            className="dl-icon-btn"
                            title="View region"
                            aria-label={`View ${r.region}`}
                            onClick={() => onView(r.region)}
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
