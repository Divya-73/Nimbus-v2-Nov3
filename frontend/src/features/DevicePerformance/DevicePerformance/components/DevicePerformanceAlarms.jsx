import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { fetchDeviceAlarms } from '../../../../api/performance';
import { clearAlarmLog } from '../../../../api/alarms';
import AlarmClearModal from '../../../Alerts/AlarmManagement/components/AlarmClearModal';
import AlarmClearAction from '../../../Alerts/AlarmManagement/components/AlarmClearAction';
import { useTimeRange } from '../utils/chartTime';
import TimeRangeToolbar from './TimeRangeToolbar';
import DevicePerformanceAlarmCharts from './DevicePerformanceAlarmCharts';
import {
  alarmTableRows,
  exportTableExcel,
  exportTablePdf,
  fetchAllDeviceAlarmsForExport,
  stampFilename,
} from '../utils/tableExport';

const PAGE_SIZES = [10, 25, 50, 100];
const SEVERITIES = ['Critical', 'Major', 'Minor', 'Warning', 'Info'];
const STATES = ['Open', 'Closed', 'Cleared'];

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

export default function DevicePerformanceAlarms({ deviceId, refreshKey, canManage = false }) {
  const {
    preset,
    range,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    rangeError,
    applyPreset,
    applyRange,
    presetLabel,
  } = useTimeRange('24h');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clearTarget, setClearTarget] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const [clearTick, setClearTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [deviceId, range, debouncedSearch, severity, state, pageSize]);

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceAlarms(deviceId, {
          from: range.from,
          to: range.to,
          page,
          pageSize,
          search: debouncedSearch,
          severity,
          state,
        });
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load device alarms');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceId, refreshKey, range, page, pageSize, debouncedSearch, severity, state, clearTick]);

  const alarms = data?.alarms || [];
  const total = Number(data?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);
  const hostname = data?.hostname || deviceId;
  const canExport = total > 0 && !loading && !exporting;

  const runExport = async (kind) => {
    if (!canExport) return;
    setExporting(true);
    setError('');
    try {
      const { rows } = await fetchAllDeviceAlarmsForExport(deviceId, {
        from: range.from,
        to: range.to,
        search: debouncedSearch,
        severity,
        state,
      });
      if (!rows.length) {
        setError('No alarms to export for the current filters');
        return;
      }
      const tableRows = alarmTableRows(rows);
      const base = `device-alarms-${hostname}`;
      if (kind === 'excel') {
        exportTableExcel(tableRows, {
          hostname,
          title: 'Device alarms',
          filename: stampFilename(base, 'xlsx'),
        });
      } else {
        exportTablePdf(tableRows, {
          hostname,
          title: 'Device alarms',
          filename: stampFilename(base, 'pdf'),
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to export device alarms');
    } finally {
      setExporting(false);
    }
  };

  async function handleClearConfirm() {
    if (!clearTarget?.id || !canManage) return;
    setClearing(true);
    setClearError('');
    try {
      await clearAlarmLog(clearTarget.id);
      setClearTarget(null);
      setClearTick((n) => n + 1);
    } catch (err) {
      setClearError(err.message || 'Failed to clear alarm');
    } finally {
      setClearing(false);
    }
  }

  const extra = useMemo(
    () => (
      <div className="lp-health__extra-filters">
        <label className="dl-field dl-field--search">
          <span className="dl-field__label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Policy, type, detail…"
            disabled={loading}
          />
        </label>
        <label className="dl-field">
          <span className="dl-field__label">Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} disabled={loading}>
            <option value="">All</option>
            {SEVERITIES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="dl-field">
          <span className="dl-field__label">Status</span>
          <select value={state} onChange={(e) => setState(e.target.value)} disabled={loading}>
            <option value="">All</option>
            {STATES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
    ),
    [loading, search, severity, state]
  );

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Device alarms from <strong>alarmlog</strong> for the {presetLabel}.
            {total > 0 ? <> Showing <strong>{fromRow}–{toRow}</strong> of <strong>{total}</strong>.</> : null}
          </>
        )}
        extra={extra}
        rangeAriaLabel="Alarm time range"
        preset={preset}
        applyPreset={applyPreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        applyRange={applyRange}
        rangeError={rangeError}
        loading={loading}
      />

      {error ? <p className="dl-error">{error}</p> : null}

      <section className={`dash-panel dl-table-panel${loading ? ' is-loading' : ''}`}>
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Device alarms</h3>
            <p className="dash-panel__meta">
              {loading ? 'Loading…' : `${total} matching · ${hostname}`}
              {exporting ? ' · preparing export…' : ''}
            </p>
          </div>
          <div className="dl-export-actions">
            <button
              type="button"
              className="dl-export-btn dl-export-btn--excel"
              onClick={() => runExport('excel')}
              disabled={!canExport}
              title={canExport ? 'Export matching alarms to Excel' : 'No rows to export'}
            >
              <FileSpreadsheet size={14} />
              Export Excel
            </button>
            <button
              type="button"
              className="dl-export-btn dl-export-btn--pdf"
              onClick={() => runExport('pdf')}
              disabled={!canExport}
              title={canExport ? 'Export matching alarms to PDF' : 'No rows to export'}
            >
              <FileDown size={14} />
              Export PDF
            </button>
          </div>
        </header>

        <div className="dl-table-scroll">
          <table className="dl-table">
            <thead>
              <tr>
                <th>Start time</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Type</th>
                <th>Policy</th>
                <th>Detail</th>
                {canManage ? <th className="dl-th-actions" aria-label="Clear" /> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6}><div className="dl-empty">Loading alarms…</div></td>
                </tr>
              ) : !alarms.length ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6}><div className="dl-empty">No alarms in this time range</div></td>
                </tr>
              ) : (
                alarms.map((row) => (
                  <tr key={row.id || `${row.startTime}-${row.alarmType}`}>
                    <td className="dl-table__strong">{formatEpoch(row.startTime)}</td>
                    <td>{severityPill(row.severityLevel)}</td>
                    <td>{statusPill(row.alarmStatus)}</td>
                    <td>{row.alarmType || '—'}</td>
                    <td>{row.policyName || '—'}</td>
                    <td className="dl-cell-wrap">{row.detail || '—'}</td>
                    {canManage ? (
                      <td className="dl-th-actions">
                        <AlarmClearAction
                          alarm={row}
                          busy={clearing && clearTarget?.id === row.id}
                          onClear={setClearTarget}
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
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              disabled={loading}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="dl-pagination__btns">
            <button
              type="button"
              className="dl-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              type="button"
              className="dl-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <DevicePerformanceAlarmCharts
        charts={data?.charts}
        hostname={hostname}
        loading={loading}
      />

      {clearTarget ? (
        <AlarmClearModal
          alarm={clearTarget}
          clearing={clearing}
          error={clearError}
          onClose={() => {
            if (!clearing) {
              setClearTarget(null);
              setClearError('');
            }
          }}
          onConfirm={handleClearConfirm}
        />
      ) : null}
    </div>
  );
}
