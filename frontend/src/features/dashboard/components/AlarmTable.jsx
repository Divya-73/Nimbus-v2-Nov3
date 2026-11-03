import React, { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { fetchAlarmLogs, fetchAlarmFilterOptions } from '../../../api/dashboard';
import { clearAlarmLog } from '../../../api/alarms';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import AlarmClearModal from '../../Alerts/AlarmManagement/components/AlarmClearModal';
import AlarmClearAction from '../../Alerts/AlarmManagement/components/AlarmClearAction';
import '../../../styles/dash-panels.css';
import '../../../styles/alarm-table.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';

const PAGE_SIZE = 10;

/** Always offer these; merge with whatever OpenSearch returns. */
const DEFAULT_SEVERITIES = ['Critical', 'Warning', 'Cleared'];
const DEFAULT_STATES = ['Open', 'Closed'];

function mergeOptions(defaults, fromApi) {
  const seen = new Set();
  const out = [];
  for (const raw of [...defaults, ...(fromApi || [])]) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function severityClass(severityLevel) {
  const key = String(severityLevel || '').toLowerCase();
  if (key.includes('crit') || key === 'major') return 'severity-pill severity-critical';
  if (key.includes('warn') || key === 'minor') return 'severity-pill severity-warning';
  if (key.includes('clear') || key === 'ok' || key === 'info') return 'severity-pill severity-cleared';
  return 'severity-pill';
}

function statusClass(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'open' || key === 'active') return 'status-pill status-open';
  if (key === 'closed' || key === 'cleared' || key === 'resolved') return 'status-pill status-closed';
  return 'status-pill';
}

function exportRows(alarms) {
  return alarms.map((a) => ({
    Severity: a.severityLevel,
    Hostname: a.hostname,
    Organization: a.organization,
    Branch: a.branch,
    Policy: a.policyName,
    'Alarm Type': a.alarmType,
    Detail: a.detail,
    'Object Type': a.objectType,
    Status: a.alarmStatus,
  }));
}

export default function AlarmTable() {
  const profile = getStoredSessionUser();
  const canClear =
    hasRole(profile, ROLES.SUPER_ADMIN) ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);
  const [alarms, setAlarms] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    severities: DEFAULT_SEVERITIES,
    states: DEFAULT_STATES,
    types: [],
  });
  const [filters, setFilters] = useState({
    severity: 'all',
    state: 'all',
    timeRange: '24h',
  });
  const [clearTarget, setClearTarget] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const options = await fetchAlarmFilterOptions();
        if (!alive) return;
        setFilterOptions({
          severities: mergeOptions(DEFAULT_SEVERITIES, options?.severities),
          states: mergeOptions(DEFAULT_STATES, options?.states),
          types: options?.types || [],
        });
      } catch {
        if (!alive) return;
        setFilterOptions({
          severities: DEFAULT_SEVERITIES,
          states: DEFAULT_STATES,
          types: [],
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.severity, filters.state, filters.timeRange]);

  const loadAlarms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAlarmLogs({
        ...filters,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setAlarms(data?.alarms || []);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      setError(err.message || 'Failed to load alarms');
      setAlarms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, refreshTick]);

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows(alarms));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alarms');
    XLSX.writeFile(wb, 'alarms.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const head = [[
      'Severity',
      'Hostname',
      'Organization',
      'Branch',
      'Policy',
      'Alarm Type',
      'Detail',
      'Object Type',
      'Status',
    ]];
    const body = alarms.map((a) => [
      a.severityLevel,
      a.hostname,
      a.organization,
      a.branch,
      a.policyName,
      a.alarmType,
      a.detail,
      a.objectType,
      a.alarmStatus,
    ]);
    doc.setFontSize(12);
    doc.text('Alarm Logs', 40, 32);
    autoTable(doc, {
      head,
      body,
      startY: 48,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save('alarms.pdf');
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  async function handleClearConfirm() {
    if (!clearTarget?.id || !canClear) return;
    setClearing(true);
    setClearError('');
    try {
      await clearAlarmLog(clearTarget.id);
      setClearTarget(null);
      setRefreshTick((n) => n + 1);
    } catch (err) {
      setClearError(err.message || 'Failed to clear alarm');
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="dash-panel alarm-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Recent Alarms</h3>
          <p className="dash-panel__meta">{total} matching · page {page} of {totalPages}</p>
        </div>
        <div className="alarm-export-actions">
          <button
            type="button"
            className="alarm-export-btn alarm-export-btn--excel"
            onClick={handleExportExcel}
            disabled={!alarms.length || loading}
            title={alarms.length ? 'Export current page to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="alarm-export-btn alarm-export-btn--pdf"
            onClick={handleExportPDF}
            disabled={!alarms.length || loading}
            title={alarms.length ? 'Export current page to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
          </button>
        </div>
      </header>

      <div className="alarm-filters">
        <select
          className="alarm-filters__select"
          value={filters.timeRange}
          onChange={(e) => updateFilter('timeRange', e.target.value)}
          aria-label="Time range"
        >
          <option value="1h">Last 1 Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="12h">Last 12 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>

        <select
          className="alarm-filters__select"
          value={filters.severity}
          onChange={(e) => updateFilter('severity', e.target.value)}
          aria-label="Severity"
        >
          <option value="all">All Severities</option>
          {filterOptions.severities.map((sev) => (
            <option key={sev} value={sev}>
              {String(sev).charAt(0).toUpperCase() + String(sev).slice(1)}
            </option>
          ))}
        </select>

        <select
          className="alarm-filters__select"
          value={filters.state}
          onChange={(e) => updateFilter('state', e.target.value)}
          aria-label="State"
        >
          <option value="all">All States</option>
          {filterOptions.states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="alarm-filters__btn"
          onClick={() => setRefreshTick((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {error ? <div className="alarm-error">{error}</div> : null}

      {loading ? (
        <div className="alarm-loading">Loading alarms…</div>
      ) : (
        <>
          <div className="alarm-table-scroll">
            <table className="alarm-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Hostname</th>
                  <th>Organization</th>
                  <th>Branch</th>
                  <th>Policy</th>
                  <th>Alarm Type</th>
                  <th>Detail</th>
                  <th>Object Type</th>
                  <th>Status</th>
                  {canClear ? <th className="dl-th-actions" aria-label="Clear" /> : null}
                </tr>
              </thead>
              <tbody>
                {!alarms.length ? (
                  <tr>
                    <td colSpan={canClear ? 10 : 9}>
                      <div className="alarm-empty">No alarms found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  alarms.map((alarm) => (
                    <tr key={alarm.id}>
                      <td>
                        <span className={severityClass(alarm.severityLevel)}>{alarm.severityLevel}</span>
                      </td>
                      <td>{alarm.hostname}</td>
                      <td>{alarm.organization}</td>
                      <td>{alarm.branch}</td>
                      <td>{alarm.policyName}</td>
                      <td>{alarm.alarmType}</td>
                      <td className="detail-cell">
                        {alarm.detail}
                      </td>
                      <td>{alarm.objectType}</td>
                      <td>
                        <span className={statusClass(alarm.alarmStatus)}>{alarm.alarmStatus}</span>
                      </td>
                      {canClear ? (
                        <td className="dl-th-actions">
                          <AlarmClearAction
                            alarm={alarm}
                            busy={clearing && clearTarget?.id === alarm.id}
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

          <div className="alarm-pagination">
            <span>
              Showing {from}–{to} of {total}
            </span>
            <div className="alarm-pagination__btns">
              <button
                type="button"
                className="alarm-filters__btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="alarm-filters__btn"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

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
    </section>
  );
}
