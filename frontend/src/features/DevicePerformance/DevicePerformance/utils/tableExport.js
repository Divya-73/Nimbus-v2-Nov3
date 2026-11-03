import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchDeviceAlarms, fetchDeviceLogs } from '../../../../api/performance';

const EXPORT_PAGE_SIZE = 200;
const MAX_PAGES = 40;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function stampFilename(base, ext) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${slug(base)}-${stamp}.${ext}`;
}

function slug(value) {
  return String(value || 'device')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'device';
}

function text(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s || s === '-' || s === '—') return '';
  return s;
}

function formatEpoch(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : '';
  }
  if (!value) return '';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(value);
}

async function pageAll(fetchPage, pickRows) {
  const all = [];
  let page = 1;
  let total = Infinity;
  let hostname = '';

  while (page <= MAX_PAGES && all.length < total) {
    const data = await fetchPage(page, EXPORT_PAGE_SIZE);
    hostname = data?.hostname || hostname;
    const batch = pickRows(data);
    total = Number(data?.total) || 0;
    all.push(...batch);
    if (!batch.length || all.length >= total) break;
    page += 1;
  }

  return { rows: all, total, hostname };
}

export function alarmTableRows(alarms) {
  return (alarms || []).map((row) => ({
    'Start time': formatEpoch(row.startTime),
    Severity: text(row.severityLevel),
    Status: text(row.alarmStatus),
    Type: text(row.alarmType),
    Policy: text(row.policyName),
    Detail: text(row.detail),
  }));
}

export function logTableRows(logs) {
  return (logs || []).map((row) => ({
    Time: formatEpoch(row.timestamp),
    Level: text(row.level),
    Source: text(row.source),
    Host: text(row.host),
    Message: text(row.message),
  }));
}

function cmdLabel(row = {}) {
  const cmd = text(row.cmd);
  const prog = text(row.prog);
  if (cmd && prog) return `${cmd} · ${prog}`;
  return cmd || prog;
}

function resultLabel(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && value >= 1_000_000_000) return formatEpoch(value);
  const s = String(value);
  if (/^\d{9,}$/.test(s)) return formatEpoch(Number(s));
  return text(s);
}

export function jobTableRows(jobs) {
  return (jobs || []).map((row) => ({
    Created: formatEpoch(row.created),
    User: text(row.user),
    Task: text(row.task) || text(row.kind),
    Type: text(row.type),
    Cmd: cmdLabel(row),
    Sent: formatEpoch(row.sent),
    Processed: formatEpoch(row.process),
    Result: resultLabel(row.result),
    Status: text(row.statusLabel),
    Message: text(row.msg),
  }));
}

export async function fetchAllDeviceAlarmsForExport(deviceId, params = {}) {
  return pageAll(
    (page, pageSize) => fetchDeviceAlarms(deviceId, { ...params, page, pageSize }),
    (data) => data?.alarms || []
  );
}

export async function fetchAllDeviceLogsForExport(deviceId, params = {}) {
  return pageAll(
    (page, pageSize) => fetchDeviceLogs(deviceId, { ...params, page, pageSize }),
    (data) => data?.logs || []
  );
}

export function exportTableExcel(rows, { hostname, title, filename }) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const keys = Object.keys(rows[0] || {});
  ws['!cols'] = keys.map((key) => ({
    wch: Math.min(48, Math.max(12, key.length + 2)),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(title || 'Export').slice(0, 31));
  XLSX.writeFile(wb, filename || stampFilename(slug(hostname || 'device'), 'xlsx'));
}

export function exportTablePdf(rows, { hostname, title, filename }) {
  const keys = Object.keys(rows[0] || {});
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(12);
  doc.text(`${title || 'Export'} · ${hostname || 'Device'} (${rows.length})`, 40, 32);
  autoTable(doc, {
    head: [keys.length ? keys : ['Value']],
    body: rows.length
      ? rows.map((row) => keys.map((key) => row[key] ?? ''))
      : [['No rows']],
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: keys.includes('Detail') || keys.includes('Message')
      ? { [keys.length - 1]: { cellWidth: 220 } }
      : undefined,
  });
  doc.save(filename || stampFilename(slug(hostname || 'device'), 'pdf'));
}
