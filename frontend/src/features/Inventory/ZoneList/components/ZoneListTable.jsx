import React from 'react';
import { Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import { zoneStatusPillClass } from '../utils/statusHelpers';

/** One name → show the name; many → "Name +N"; none → count or em dash. */
function formatNameList(names, count) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  if (list.length === 1) return list[0];
  if (list.length > 1) return `${list[0]} +${list.length - 1}`;
  const n = count ?? 0;
  return n > 0 ? String(n) : '—';
}

export default function ZoneListTable({
  zones,
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
          <h3 className="dash-panel__title">Zones</h3>
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
            title={canExport ? 'Export zones to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="dl-export-btn dl-export-btn--pdf"
            onClick={onExportPdf}
            disabled={!canExport}
            title={canExport ? 'Export zones to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
          </button>
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading zones…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Organizations</th>
                  <th>Regions</th>
                  <th>Devices</th>
                  <th>Up</th>
                  <th>Down</th>
                  <th>Up %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!zones.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No zones found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  zones.map((z) => (
                    <tr key={z.id || z.zone}>
                      <td className="dl-table__strong">{z.zone}</td>
                      <td title={(z.orgNames || []).join(', ')}>
                        {formatNameList(z.orgNames, z.orgCount)}
                      </td>
                      <td title={(z.regions || []).join(', ')}>
                        {formatNameList(z.regions, z.regionCount)}
                      </td>
                      <td>{z.deviceCount?.total ?? 0}</td>
                      <td>{z.deviceCount?.up ?? 0}</td>
                      <td>{z.deviceCount?.down ?? 0}</td>
                      <td>{z.deviceCount?.upPercentage ?? 0}%</td>
                      <td>
                        <span className={zoneStatusPillClass(z.status)}>{z.status || '—'}</span>
                      </td>
                      <td>
                        <div className="dl-row-actions">
                          <button
                            type="button"
                            className="dl-icon-btn"
                            title="View zone"
                            aria-label={`View ${z.zone}`}
                            onClick={() => onView(z.zone)}
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
