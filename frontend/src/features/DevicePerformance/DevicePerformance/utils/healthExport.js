import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function slug(value) {
  return String(value || 'device')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'device';
}

function formatTime(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString();
}

function seriesRows(metric, series = [], formatValue) {
  const fmt = formatValue || ((n) => Number(n).toFixed(2));
  return series
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map(([ts, value]) => ({
      Time: formatTime(ts),
      [metric]: value == null || !Number.isFinite(Number(value)) ? '' : fmt(Number(value)),
    }));
}

function multiSeriesRows(seriesList = [], formatValue) {
  const fmt = formatValue || ((n) => Number(n).toFixed(2));
  const byTs = new Map();
  const names = [];

  for (const item of seriesList) {
    const name = item?.name || 'Value';
    names.push(name);
    for (const point of item?.data || []) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const ts = Number(point[0]);
      if (!Number.isFinite(ts)) continue;
      const row = byTs.get(ts) || { Time: formatTime(ts), _ts: ts };
      const value = point[1];
      row[name] = value == null || !Number.isFinite(Number(value)) ? '' : fmt(Number(value));
      byTs.set(ts, row);
    }
  }

  return [...byTs.values()]
    .sort((a, b) => a._ts - b._ts)
    .map(({ _ts, ...row }) => row);
}

function fileBase(hostname, metric, prefix = 'device-health') {
  return `${prefix}-${slug(hostname)}-${slug(metric).toLowerCase()}-${stamp()}`;
}

function tableColumns(tableRows = []) {
  return tableRows[0] ? Object.keys(tableRows[0]) : [];
}

function resolveExportRows({ metric, series, seriesList, tableRows, formatValue }) {
  if (Array.isArray(tableRows) && tableRows.length) return tableRows;
  if (seriesList?.length) return multiSeriesRows(seriesList, formatValue);
  return seriesRows(metric, series, formatValue);
}

function emptyExportRow({ metric, seriesList, tableRows }) {
  if (Array.isArray(tableRows)) {
    const columns = tableColumns(tableRows);
    return columns.length
      ? Object.fromEntries(columns.map((col) => [col, '']))
      : { Value: '' };
  }
  if (seriesList?.length) {
    return { Time: '', ...Object.fromEntries(seriesList.map((item) => [item.name, ''])) };
  }
  return { Time: '', [metric]: '' };
}

function chartInstance(chartRef) {
  return chartRef?.current?.getEchartsInstance?.() || null;
}

function rawChartDataUrl(chartRef) {
  const inst = chartInstance(chartRef);
  if (!inst) return '';
  try {
    return inst.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
  } catch {
    return '';
  }
}

function toPngDataUrl(dataUrl) {
  if (!dataUrl) return Promise.resolve('');
  if (dataUrl.startsWith('data:image/png')) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 320;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

export async function chartPngDataUrl(chartRef) {
  return toPngDataUrl(rawChartDataUrl(chartRef));
}

export function downloadHealthExcel({
  hostname,
  metric,
  series,
  seriesList,
  tableRows,
  filePrefix = 'device-health',
  formatValue,
}) {
  const rows = resolveExportRows({ metric, series, seriesList, tableRows, formatValue });
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [emptyExportRow({ metric, seriesList, tableRows })]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(metric || 'Chart').slice(0, 31));
  XLSX.writeFile(wb, `${fileBase(hostname, metric, filePrefix)}.xlsx`);
}

export async function downloadHealthPng(chartRef, { hostname, metric, filePrefix = 'device-health' }) {
  const url = await chartPngDataUrl(chartRef);
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileBase(hostname, metric, filePrefix)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadHealthPdf({
  hostname,
  metric,
  series,
  seriesList,
  tableRows,
  chartRef,
  fromMs,
  toMs,
  filePrefix = 'device-health',
  formatValue,
  note = '1-minute buckets',
}) {
  const imageDataUrl = await chartPngDataUrl(chartRef);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const title = `${metric} - ${hostname || 'Device'}`;
  const from = fromMs ? formatTime(fromMs) : '';
  const to = toMs ? formatTime(toMs) : '';
  const rows = resolveExportRows({ metric, series, seriesList, tableRows, formatValue });
  const columns = tableRows?.length
    ? tableColumns(tableRows)
    : (seriesList?.length ? ['Time', ...seriesList.map((item) => item.name)] : ['Time', metric]);

  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Range: ${from} to ${to}  |  Points: ${rows.length}  |  ${note}`, 40, 54);
  doc.setTextColor(0);

  let tableStart = 68;
  if (imageDataUrl) {
    try {
      const pageW = doc.internal.pageSize.getWidth();
      const imgW = pageW - 80;
      const imgH = Math.min(280, imgW * 0.42);
      doc.addImage(imageDataUrl, 'PNG', 40, 64, imgW, imgH);
      tableStart = 64 + imgH + 16;
    } catch {
      tableStart = 68;
    }
  }

  autoTable(doc, {
    startY: tableStart,
    head: [columns],
    body: rows.map((row) => columns.map((col) => row[col] ?? '')),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(`${fileBase(hostname, metric, filePrefix)}.pdf`);
}
