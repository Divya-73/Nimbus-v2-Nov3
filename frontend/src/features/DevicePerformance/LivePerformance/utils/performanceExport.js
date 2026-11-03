import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchLivePerformance } from '../../../../api/performance';

const EXPORT_PAGE_SIZE = 500;

function text(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s || s === '-' || s === '—') return '';
  return s;
}

function formatSdwan(sdwan) {
  if (sdwan && typeof sdwan === 'object') return text(sdwan.status);
  return text(sdwan);
}

/** Flat row with every live-performance field we return from the API. */
export function performanceExportRows(devices) {
  return (devices || []).map((d) => {
    const lan = d.lan || {};
    const wan = d.wan || {};
    const lte = d.lte || {};

    return {
      Hostname: text(d.hostname),
      Organization: text(d.org),
      'Org ID': text(d.orgId),
      Branch: text(d.branch),
      'Branch ID': text(d.branchId),
      Zone: text(d.zone),
      Region: text(d.region),
      Model: text(d.model),
      Version: text(d.version),
      Phase: text(d.phase),
      Tags: text(d.tags),
      'Outlet Name': text(d.outletName),
      'SAP Code': text(d.sapCode),
      'JDE Code': text(d.jdeCode),
      'Sales Area': text(d.salesArea),
      'Automation Vendor': text(d.automationVendor),

      'Device Status': text(d.status),
      'SD-WAN': formatSdwan(d.sdwanStatus),
      Online: d.isOnline ? 'Yes' : 'No',

      'LAN Status': text(lan.status),
      'LAN Interfaces': text(lan.interfaces),
      'LAN IP': text(lan.ip),

      'WAN Status': text(wan.status),
      'WAN Interfaces': text(wan.interfaces),
      'WAN IP': text(wan.ip),

      'LTE Status': text(lte.status),
      'LTE Interfaces': text(lte.interfaces),
      'LTE IP': text(lte.ip),

      'CPU %': d.cpu ?? '',
      'Mem %': d.memory ?? '',
      Uptime: text(d.uptime),
      'Last Boot': text(d.lastBoot),
      'Last Updated': text(d.lastUpdated),
      'Date Created': text(d.dateCreated),
    };
  });
}

/** Fetch every matching live-performance row for active filters. */
export async function fetchAllPerformanceForExport(filterParams = {}) {
  const pageSize = EXPORT_PAGE_SIZE;
  let page = 1;
  let all = [];
  let total = Infinity;

  while (all.length < total) {
    const data = await fetchLivePerformance({
      ...filterParams,
      page,
      pageSize,
    });
    const batch = data?.devices || [];
    total = Number(data?.total) || 0;
    all = all.concat(batch);
    if (!batch.length || batch.length < pageSize || all.length >= total) break;
    page += 1;
    if (page > 50) break;
  }

  return { devices: all, total };
}

export function downloadPerformanceExcel(devices) {
  const rows = performanceExportRows(devices);
  const ws = XLSX.utils.json_to_sheet(rows);
  // Widen columns a bit for readability
  ws['!cols'] = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(28, Math.max(12, key.length + 2)),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Live Performance');
  XLSX.writeFile(wb, `live-performance-${stamp()}.xlsx`);
}

export function downloadPerformancePdf(devices) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });

  // Compact printable set (full detail is in Excel)
  const head = [[
    'Hostname',
    'Org',
    'Branch',
    'Model',
    'Status',
    'SD-WAN',
    'LAN',
    'WAN',
    'LTE',
    'CPU',
    'Mem',
    'Uptime',
    'Updated',
  ]];

  const body = (devices || []).map((d) => [
    text(d.hostname),
    text(d.org),
    text(d.branch),
    text(d.model),
    text(d.status),
    formatSdwan(d.sdwanStatus),
    text(d.lan?.interfaces || d.lan?.status),
    text(d.wan?.interfaces || d.wan?.status),
    text(d.lte?.interfaces || d.lte?.status),
    d.cpu ?? '',
    d.memory ?? '',
    text(d.uptime),
    text(d.lastUpdated),
  ]);

  doc.setFontSize(12);
  doc.text(`Live Performance (${body.length})`, 40, 28);
  doc.setFontSize(8);
  doc.text('Tip: use Excel export for full interface lists and inventory fields.', 40, 42);

  autoTable(doc, {
    head,
    body,
    startY: 52,
    styles: { fontSize: 6, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(`live-performance-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
