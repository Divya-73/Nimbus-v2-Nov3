import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function listJoin(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

export function orgExportRows(orgs) {
  return (orgs || []).map((o) => ({
    Organization: o.orgName ?? '',
    'Org ID': o.orgId ?? '',
    Zones: listJoin(o.zones),
    'Zone Count': o.zoneCount ?? 0,
    Regions: listJoin(o.regions),
    'Region Count': o.regionCount ?? 0,
    Branches: o.branchCount ?? 0,
    Networks: o.networkCount ?? 0,
    Devices: o.deviceCount?.total ?? 0,
    Up: o.deviceCount?.up ?? 0,
    Down: o.deviceCount?.down ?? 0,
    'Up %': o.deviceCount?.upPercentage ?? 0,
    Status: o.status ?? '',
  }));
}

export function downloadOrgsExcel(orgs) {
  const rows = orgExportRows(orgs);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Organizations');
  XLSX.writeFile(wb, `organizations-${stamp()}.xlsx`);
}

export function downloadOrgsPdf(orgs) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [
    ['Organization', 'Zones', 'Regions', 'Branches', 'Devices', 'Up', 'Down', 'Up %', 'Status'],
  ];
  const body = (orgs || []).map((o) => [
    o.orgName ?? '',
    o.zoneCount ?? 0,
    o.regionCount ?? 0,
    o.branchCount ?? 0,
    o.deviceCount?.total ?? 0,
    o.deviceCount?.up ?? 0,
    o.deviceCount?.down ?? 0,
    o.deviceCount?.upPercentage ?? 0,
    o.status ?? '',
  ]);

  doc.setFontSize(12);
  doc.text(`Organization List (${body.length})`, 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`organizations-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
