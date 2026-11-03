import React from 'react';
import { Eye, FileDown, FileSpreadsheet, FileStack, Monitor, Pencil, SlidersHorizontal, Terminal, Trash2 } from 'lucide-react';
import {
  formatSdwan,
  sdwanPillClass,
  statusPillClass,
} from '../../../Inventory/shared/statusHelpers';
import { PERF_COLUMNS } from '../utils/columnConfig';
import ColumnPicker from './ColumnPicker';
import LanPortList from '../../../Inventory/shared/LanPortList';

function LinkStatusPill({ status }) {
  const key = String(status ?? '').toLowerCase();
  const normalized = key === 'n/a' ? 'na' : key;
  return <span className={statusPillClass(normalized)}>{status || '—'}</span>;
}

function MissingLinkCell() {
  return <LinkStatusPill status="N/A" />;
}

function withStaleHint(ports, stale) {
  if (!stale) return ports;
  return ports.map((port) => ({
    ...port,
    status: 'down',
  }));
}

function PortListCell({ group }) {
  if (!group) return '—';
  const ports = Array.isArray(group.ports) ? group.ports : [];
  if (!ports.length) return <MissingLinkCell />;

  const stale = group.stale === true;
  return (
    <div className={`lp-cell lp-cell--ports${stale ? ' lp-cell--stale' : ''}`}>
      <LanPortList ports={withStaleHint(ports, stale)} quiet />
    </div>
  );
}

function SdwanCell({ sdwan, lan, wan, lte }) {
  const status = formatSdwan(sdwan);
  const up = String(status).toUpperCase() === 'UP';
  const wanStatuses = (wan?.ports || []).map((port) => port.status);
  const lteStatuses = (lte?.ports || []).map((port) => port.status);
  const linksDown =
    up &&
    [lan?.status, ...wanStatuses, ...lteStatuses].every((s) => {
      const v = String(s ?? '').toUpperCase();
      return v === 'DOWN' || v === 'N/A' || v === 'NA' || !v;
    });

  const heartbeat = up
    ? 'Heartbeat OK — controller received a recent heartbeat. Not LAN/WAN/LTE underlay.'
    : 'No heartbeat — CPE silent within the activity window.';

  return (
    <span
      className={sdwanPillClass(sdwan)}
      title={linksDown ? `${heartbeat} LAN/WAN/LTE underlay still down.` : heartbeat}
    >
      {status || '—'}
    </span>
  );
}

function isDeviceOffline(d) {
  if (d?.isOnline === false) return true;
  const status = String(d?.status ?? '').toLowerCase();
  if (status === 'down' || status === 'onboard') return true;
  const sdwan = String(d?.sdwanStatus?.status ?? d?.sdwanStatus ?? '').toUpperCase();
  return sdwan === 'DOWN';
}

function MetricCell({ value, stale, staleLabel = 'Last reported', title }) {
  const display = value == null || value === '' ? '—' : value;
  return (
    <div className={`lp-cell${stale ? ' lp-cell--stale' : ''}`} title={title}>
      <span className="lp-cell__value">{display}</span>
      {stale ? (
        <span className="lp-stale-tag" title="Value from last time this device reported">
          {staleLabel}
        </span>
      ) : null}
    </div>
  );
}

function renderCell(colId, d, { onView, onOpenGui, openingGuiId, canManage, onEditIfaces, onDelete, onOpenCli, onOpenAlarmPolicy }) {
  const offline = isDeviceOffline(d);

  switch (colId) {
    case 'hostname':
      return <td key={colId} className="dl-table__strong">{d.hostname}</td>;
    case 'org':
      return <td key={colId}>{d.org}</td>;
    case 'branch':
      return <td key={colId}>{d.branch}</td>;
    case 'zone':
      return <td key={colId}>{d.zone}</td>;
    case 'region':
      return <td key={colId}>{d.region}</td>;
    case 'model':
      return <td key={colId}>{d.model}</td>;
    case 'version':
      return <td key={colId}>{d.version}</td>;
    case 'phase':
      return <td key={colId}>{d.phase}</td>;
    case 'tags':
      return <td key={colId}>{d.tags}</td>;
    case 'outletName':
      return <td key={colId}>{d.outletName}</td>;
    case 'sapCode':
      return <td key={colId}>{d.sapCode}</td>;
    case 'jdeCode':
      return <td key={colId}>{d.jdeCode}</td>;
    case 'salesArea':
      return <td key={colId}>{d.salesArea}</td>;
    case 'automationVendor':
      return <td key={colId}>{d.automationVendor}</td>;
    case 'status':
      return (
        <td key={colId}>
          <span className={statusPillClass(d.status)}>{d.status || '—'}</span>
        </td>
      );
    case 'sdwanStatus':
      return (
        <td key={colId}>
            <SdwanCell
              sdwan={d.sdwanStatus}
              lan={d.lan}
              wan={d.wan}
              lte={d.lte}
            />
        </td>
      );
    case 'lan':
      return (
        <td key={colId}>
          <PortListCell group={d.lan} />
        </td>
      );
    case 'wan':
      return (
        <td key={colId}>
          <PortListCell group={d.wan} />
        </td>
      );
    case 'lte':
      return (
        <td key={colId}>
          <PortListCell group={d.lte} />
        </td>
      );
    case 'cpu':
      return (
        <td key={colId}>
          <MetricCell value={d.cpu} stale={offline} />
        </td>
      );
    case 'memory':
      return (
        <td key={colId}>
          <MetricCell value={d.memory} stale={offline} />
        </td>
      );
    case 'uptime':
      return (
        <td key={colId}>
          <MetricCell
            value={d.uptime || '—'}
            stale={offline}
            staleLabel="Downtime"
            title={
              offline
                ? 'Time since last heartbeat'
                : 'Time since this CPE last came online. Last boot is a separate column.'
            }
          />
        </td>
      );
    case 'lastBoot':
      return (
        <td key={colId}>
          <MetricCell value={d.lastBoot || '—'} stale={offline} />
        </td>
      );
    case 'lastUpdated':
      return <td key={colId}>{d.lastUpdated || '—'}</td>;
    case 'dateCreated':
      return <td key={colId}>{d.dateCreated || '—'}</td>;
    case 'actions': {
      const hasGui = Boolean(d.guiIp || (Array.isArray(d.ipv4) && d.ipv4.length) || (Array.isArray(d.ips) && d.ips.length));
      const guiBusy = openingGuiId === d.id;
      return (
        <td key={colId}>
          <div className="dl-row-actions">
            <button
              type="button"
              className="dl-icon-btn"
              title="View device"
              aria-label={`View ${d.hostname}`}
              onClick={() => onView(d.id)}
            >
              <Eye size={14} />
            </button>
            <button
              type="button"
              className="dl-icon-btn"
              disabled={!hasGui || guiBusy || !onOpenGui}
              aria-label={`Open GUI for ${d.hostname}`}
              onClick={() => onOpenGui?.(d)}
              title={
                hasGui
                  ? 'Select IP and open device GUI via cloud proxy'
                  : 'No IP available for GUI'
              }
            >
              <Monitor size={14} />
            </button>
            {canManage ? (
              <button
                type="button"
                className="dl-icon-btn"
                disabled={!hasGui || !onOpenCli}
                aria-label={`Open CLI for ${d.hostname}`}
                onClick={() => onOpenCli?.(d)}
                title={hasGui ? 'Open CLI tab for this CPE' : 'No IP available for CLI'}
              >
                <Terminal size={14} />
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="dl-icon-btn"
                aria-label={`Alarm policy for ${d.hostname}`}
                onClick={() => onOpenAlarmPolicy?.(d)}
                title="Open alarm policy for this CPE"
              >
                <SlidersHorizontal size={14} />
              </button>
            ) : null}
            {canManage ? (
              <>
                <button
                  type="button"
                  className="dl-icon-btn"
                  title="Edit site config"
                  aria-label={`Edit site config for ${d.hostname}`}
                  onClick={() => onEditIfaces?.(d.id)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="dl-icon-btn"
                  title="Delete device"
                  aria-label={`Delete ${d.hostname}`}
                  onClick={() => onDelete?.(d)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : null}
          </div>
        </td>
      );
    }
    default:
      return null;
  }
}

export default function LivePerformanceTable({
  devices,
  loading,
  error,
  total,
  page,
  pageSize,
  visibleColumns,
  columnPickerOpen,
  onColumnPickerToggle,
  onVisibleColumnsChange,
  onResetColumns,
  onPageChange,
  onPageSizeChange,
  onView,
  onOpenGui,
  openingGuiId = null,
  onOpenCli,
  onOpenAlarmPolicy,
  canManage = false,
  onEditIfaces,
  exporting = false,
  onExportExcel,
  onExportPdf,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectPage,
  onProvision,
  onDelete,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canExport = total > 0 && !loading && !exporting;

  const orderedVisible = PERF_COLUMNS.filter((c) => visibleColumns.includes(c.id));
  const selectedSet = new Set((selectedIds || []).map(String));
  const pageIds = (devices || []).map((d) => String(d.id));
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const selectedCount = selectedSet.size;
  const colCount = Math.max(orderedVisible.length, 1) + (canManage ? 1 : 0);

  return (
    <section className="dash-panel dl-table-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Live Performance</h3>
          <p className="dash-panel__meta">
            {total} devices · showing {from}–{to}
            {exporting ? ' · preparing export…' : ''}
            {' · '}
            CPU/Mem and LAN/WAN/LTE chips on offline CPEs are last reported
            {' · '}
            Uptime is time online since last reconnect, not time since reboot
            {' · '}
            SD-WAN = heartbeat (hover for detail)
          </p>
        </div>
        <div className="dl-export-actions lp-table-actions">
          {canManage ? (
            <button
              type="button"
              className="dl-btn dl-btn--accent"
              onClick={onProvision}
              disabled={!selectedCount || loading}
              title={selectedCount ? `Provision template to ${selectedCount} selected` : 'Select one or more devices'}
            >
              <FileStack size={14} />
              Provision template
              {selectedCount ? ` (${selectedCount})` : ''}
            </button>
          ) : null}
          <button
            type="button"
            className="dl-export-btn dl-export-btn--excel"
            onClick={onExportExcel}
            disabled={!canExport}
            title={canExport ? 'Export all matching rows to Excel' : 'No rows to export'}
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            type="button"
            className="dl-export-btn dl-export-btn--pdf"
            onClick={onExportPdf}
            disabled={!canExport}
            title={canExport ? 'Export all matching rows to PDF' : 'No rows to export'}
          >
            <FileDown size={14} />
            Export PDF
          </button>
          <ColumnPicker
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
        <div className="dl-empty">Loading performance…</div>
      ) : (
        <>
          <div className="dl-table-scroll">
            <table className="dl-table lp-table">
              <thead>
                <tr>
                  {canManage ? (
                    <th className="lp-th-check">
                      <input
                        type="checkbox"
                        className="tpl-check-input"
                        checked={pageAllSelected}
                        disabled={!pageIds.length || loading}
                        onChange={(e) => onToggleSelectPage?.(e.target.checked, pageIds)}
                        aria-label="Select all devices on this page"
                      />
                    </th>
                  ) : null}
                  {orderedVisible.map((c) => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!devices.length ? (
                  <tr>
                    <td colSpan={colCount}>
                      <div className="dl-empty">No devices found for selected filters</div>
                    </td>
                  </tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.id} className={selectedSet.has(String(d.id)) ? 'lp-row--selected' : undefined}>
                      {canManage ? (
                        <td className="lp-th-check">
                          <input
                            type="checkbox"
                            className="tpl-check-input"
                            checked={selectedSet.has(String(d.id))}
                            onChange={() => onToggleSelect?.(d.id)}
                            aria-label={`Select ${d.hostname}`}
                          />
                        </td>
                      ) : null}
                      {orderedVisible.map((c) =>
                        renderCell(c.id, d, {
                          onView,
                          onOpenGui,
                          openingGuiId,
                          onOpenCli,
                          onOpenAlarmPolicy,
                          canManage,
                          onEditIfaces,
                          onDelete,
                        }),
                      )}
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
                {[5, 10, 25, 50, 100].map((n) => (
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
