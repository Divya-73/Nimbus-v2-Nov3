import React from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import AlarmColumnPicker from './AlarmColumnPicker';
import AlarmClearAction from './AlarmClearAction';
import { orderedVisibleColumns } from '../utils/columnConfig';

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

function severityPill(severity) {
  const key = String(severity || '').toLowerCase();
  if (key.includes('crit') || key === 'major') {
    return <span className="dl-pill dl-pill--down">{severity || '—'}</span>;
  }
  if (key.includes('warn') || key === 'minor') {
    return <span className="dl-pill dl-pill--partial">{severity || '—'}</span>;
  }
  if (key.includes('clear') || key === 'ok' || key === 'info') {
    return <span className="dl-pill dl-pill--up">{severity || '—'}</span>;
  }
  return <span className="dl-pill">{severity || '—'}</span>;
}

function statusPill(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'open' || key === 'active') {
    return <span className="dl-pill dl-pill--partial">{status || '—'}</span>;
  }
  if (key === 'closed' || key === 'cleared' || key === 'resolved') {
    return <span className="dl-pill dl-pill--up">{status || '—'}</span>;
  }
  return <span className="dl-pill">{status || '—'}</span>;
}

function renderCell(row, colId) {
  if (colId === 'startTime' || colId === 'endTime') return formatEpoch(row[colId]);
  if (colId === 'severityLevel') return severityPill(row.severityLevel);
  if (colId === 'alarmStatus') return statusPill(row.alarmStatus);
  const v = row?.[colId];
  if (v == null || v === '') return '—';
  return String(v);
}

export default function AlarmManageTable({
  alarms,
  loading,
  error,
  total,
  page,
  pageSize,
  visibleColumns,
  columnPickerOpen,
  exporting,
  onPageChange,
  onPageSizeChange,
  onVisibleColumnsChange,
  onColumnPickerToggle,
  onResetColumns,
  onExportExcel,
  onExportPdf,
  canClear = false,
  clearingId = '',
  onClear,
}) {
  const cols = orderedVisibleColumns(visibleColumns);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canExport = total > 0 && !loading && !exporting;
  const colSpan = Math.max(cols.length, 1) + (canClear ? 1 : 0);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Alarm log</h3>
          <p className="dash-panel__meta">
            {total} matching · showing {from}–{to}
            {exporting ? ' · preparing export…' : ''}
          </p>
        </div>
        <div className="dl-export-actions alarm-mgmt-toolbar">
          <button
            type="button"
            className="dl-export-btn dl-export-btn--excel"
            onClick={onExportExcel}
            disabled={!canExport}
            title={canExport ? 'Export matching alarms to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="dl-export-btn dl-export-btn--pdf"
            onClick={onExportPdf}
            disabled={!canExport}
            title={canExport ? 'Export matching alarms to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
          </button>
          <AlarmColumnPicker
            open={columnPickerOpen}
            visibleIds={visibleColumns}
            onChange={onVisibleColumnsChange}
            onOpenToggle={() => onColumnPickerToggle((v) => !v)}
            onClose={() => onColumnPickerToggle(false)}
            onResetDefault={onResetColumns}
          />
        </div>
      </header>

      {error ? <p className="dl-error">{error}</p> : null}

      {loading ? (
        <div className="dl-empty">Loading alarms…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                  {canClear ? <th className="dl-th-actions" aria-label="Clear" /> : null}
                </tr>
              </thead>
              <tbody>
                {!alarms.length ? (
                  <tr>
                    <td colSpan={colSpan}>
                      <div className="dl-empty">No alarms found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  alarms.map((row) => (
                    <tr key={row.id || `${row.hostname}-${row.startTime}-${row.alarmType}`}>
                      {cols.map((c) => (
                        <td
                          key={c.id}
                          className={
                            c.id === 'startTime'
                              ? 'dl-table__strong'
                              : c.id === 'detail'
                                ? 'dl-cell-wrap'
                                : undefined
                          }
                        >
                          {renderCell(row, c.id)}
                        </td>
                      ))}
                      {canClear ? (
                        <td className="dl-th-actions">
                          <AlarmClearAction
                            alarm={row}
                            busy={clearingId === row.id}
                            onClear={onClear}
                          />
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
