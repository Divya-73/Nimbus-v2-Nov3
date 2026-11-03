import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { orderedVisibleColumns } from './columnConfig';

function formatEpoch(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

function cellValue(row, id) {
  if (id === 'startTime' || id === 'endTime') return formatEpoch(row[id]);
  const v = row?.[id];
  if (v == null || v === '') return '';
  return String(v);
}

export function alarmExportRows(alarms, visibleIds) {
  const cols = orderedVisibleColumns(visibleIds);
  return (alarms || []).map((row) => {
    const out = {};
    for (const col of cols) {
      out[col.label] = cellValue(row, col.id);
    }
    return out;
  });
}

export function exportAlarmsExcel(alarms, visibleIds, filename = 'alarms.xlsx') {
  const rows = alarmExportRows(alarms, visibleIds);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alarms');
  XLSX.writeFile(wb, filename);
}

export function exportAlarmsPdf(alarms, visibleIds, filename = 'alarms.pdf') {
  const cols = orderedVisibleColumns(visibleIds);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const head = [cols.map((c) => c.label)];
  const body = (alarms || []).map((row) => cols.map((c) => cellValue(row, c.id)));

  doc.setFontSize(12);
  doc.text('Alarm Management', 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(filename);
}

export function stampFilename(base, ext) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}-${stamp}.${ext}`;
}
