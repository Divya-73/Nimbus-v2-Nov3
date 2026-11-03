import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function regionExportRows(regions) {
  return (regions || []).map((r) => ({
    Region: r.region ?? '',
    Organizations: Array.isArray(r.orgNames) ? r.orgNames.join(', ') : '',
    'Org Count': r.orgCount ?? 0,
    Zones: Array.isArray(r.zones) ? r.zones.join(', ') : '',
    'Zone Count': r.zoneCount ?? 0,
    Devices: r.deviceCount?.total ?? 0,
    Up: r.deviceCount?.up ?? 0,
    Down: r.deviceCount?.down ?? 0,
    'Up %': r.deviceCount?.upPercentage ?? 0,
    Status: r.status ?? '',
  }));
}

export function downloadRegionsExcel(regions) {
  const rows = regionExportRows(regions);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regions');
  XLSX.writeFile(wb, `regions-${stamp()}.xlsx`);
}

export function downloadRegionsPdf(regions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [['Region', 'Orgs', 'Zones', 'Devices', 'Up', 'Down', 'Up %', 'Status']];
  const body = (regions || []).map((r) => [
    r.region ?? '',
    Array.isArray(r.orgNames) ? r.orgNames.join(', ') : '',
    Array.isArray(r.zones) ? r.zones.join(', ') : '',
    r.deviceCount?.total ?? 0,
    r.deviceCount?.up ?? 0,
    r.deviceCount?.down ?? 0,
    r.deviceCount?.upPercentage ?? 0,
    r.status ?? '',
  ]);

  doc.setFontSize(12);
  doc.text(`Region List (${body.length})`, 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`regions-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
