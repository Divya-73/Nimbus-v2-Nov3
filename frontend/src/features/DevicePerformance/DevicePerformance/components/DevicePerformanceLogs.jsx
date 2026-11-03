import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { fetchDeviceLogs } from '../../../../api/performance';
import { useTimeRange } from '../utils/chartTime';
import TimeRangeToolbar from './TimeRangeToolbar';
import {
  exportTableExcel,
  exportTablePdf,
  fetchAllDeviceLogsForExport,
  logTableRows,
  stampFilename,
} from '../utils/tableExport';

const PAGE_SIZES = [10, 25, 50, 100];
const LEVELS = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];

function formatTs(value) {
  if (!value) return '—';
  const n = Number(value);
  const d = Number.isFinite(n) && n > 0
    ? new Date(n < 1e12 ? n * 1000 : n)
    : new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleString();
}

function levelPill(level) {
  const key = String(level || '').toLowerCase();
  if (['emerg', 'emergency', 'alert', 'crit', 'critical', 'err', 'error'].some((k) => key.includes(k))) {
    return <span className="dl-pill dl-pill--down">{level || '—'}</span>;
  }
  if (key.includes('warn')) {
    return <span className="dl-pill dl-pill--partial">{level || '—'}</span>;
  }
  if (key.includes('info') || key.includes('notice') || key.includes('debug')) {
    return <span className="dl-pill dl-pill--up">{level || '—'}</span>;
  }
  return <span className="dl-pill">{level || '—'}</span>;
}

export default function DevicePerformanceLogs({ deviceId, refreshKey }) {
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
  } = useTimeRange('6h');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [deviceId, range, debouncedSearch, level, source, pageSize]);

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceLogs(deviceId, {
          from: range.from,
          to: range.to,
          page,
          pageSize,
          search: debouncedSearch,
          level,
          source,
        });
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load device logs');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceId, refreshKey, range, page, pageSize, debouncedSearch, level, source]);

  const logs = data?.logs || [];
  const total = Number(data?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);
  const sources = data?.sources || [];
  const ipHint = (data?.ips || []).join(', ');
  const hostname = data?.hostname || deviceId;
  const canExport = total > 0 && !loading && !exporting;

  const runExport = async (kind) => {
    if (!canExport) return;
    setExporting(true);
    setError('');
    try {
      const { rows } = await fetchAllDeviceLogsForExport(deviceId, {
        from: range.from,
        to: range.to,
        search: debouncedSearch,
        level,
        source,
      });
      if (!rows.length) {
        setError('No logs to export for the current filters');
        return;
      }
      const tableRows = logTableRows(rows);
      const base = `device-logs-${hostname}`;
      if (kind === 'excel') {
        exportTableExcel(tableRows, {
          hostname,
          title: 'Device logs',
          filename: stampFilename(base, 'xlsx'),
        });
      } else {
        exportTablePdf(tableRows, {
          hostname,
          title: 'Device logs',
          filename: stampFilename(base, 'pdf'),
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to export device logs');
    } finally {
      setExporting(false);
    }
  };

  const extra = useMemo(
    () => (
      <div className="lp-health__extra-filters">
        <label className="dl-field dl-field--search">
          <span className="dl-field__label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Message, host, source…"
            disabled={loading}
          />
        </label>
        <label className="dl-field">
          <span className="dl-field__label">Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} disabled={loading}>
            <option value="">All</option>
            {LEVELS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="dl-field">
          <span className="dl-field__label">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} disabled={loading}>
            <option value="">All</option>
            {sources.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
            {source && !sources.includes(source) ? (
              <option value={source}>{source}</option>
            ) : null}
          </select>
        </label>
      </div>
    ),
    [level, loading, search, source, sources]
  );

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Syslog for this CPE over the {presetLabel}
            {ipHint ? <> · matched IPs <strong>{ipHint}</strong></> : ' · no interface IPv4 to match'}.
            {total > 0 ? <> Showing <strong>{fromRow}–{toRow}</strong> of <strong>{total}</strong>.</> : null}
          </>
        )}
        extra={extra}
        rangeAriaLabel="Log time range"
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
            <h3 className="dash-panel__title">Device logs</h3>
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
              title={canExport ? 'Export matching logs to Excel' : 'No rows to export'}
            >
              <FileSpreadsheet size={14} />
              Export Excel
            </button>
            <button
              type="button"
              className="dl-export-btn dl-export-btn--pdf"
              onClick={() => runExport('pdf')}
              disabled={!canExport}
              title={canExport ? 'Export matching logs to PDF' : 'No rows to export'}
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
                <th>Time</th>
                <th>Level</th>
                <th>Source</th>
                <th>Host</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}><div className="dl-empty">Loading logs…</div></td>
                </tr>
              ) : !logs.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dl-empty">
                      {ipHint ? 'No syslog rows in this time range' : 'No IPv4 addresses on this device to match syslog'}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id || `${row.timestamp}-${row.message}`}>
                    <td className="dl-table__strong">{formatTs(row.timestamp)}</td>
                    <td>{levelPill(row.level)}</td>
                    <td>{row.source || '—'}</td>
                    <td>{row.host || '—'}</td>
                    <td className="dl-cell-wrap">{row.message || '—'}</td>
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
    </div>
  );
}
