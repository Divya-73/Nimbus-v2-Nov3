import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function branchExportRows(branches) {
  return (branches || []).map((b) => ({
    Branch: b.branch ?? '',
    Type: b.branchType ?? '',
    'Site ID': b.siteId ?? '',
    Organization: b.orgName ?? '',
    Zone: b.zone ?? '',
    Region: b.region ?? '',
    Devices: b.deviceCount?.total ?? 0,
    Up: b.deviceCount?.up ?? 0,
    Down: b.deviceCount?.down ?? 0,
    'Up %': b.deviceCount?.upPercentage ?? 0,
    Status: b.branchStatus ?? '',
    Tags: b.tags ?? '',
  }));
}

export function downloadBranchesExcel(branches) {
  const rows = branchExportRows(branches);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Branches');
  XLSX.writeFile(wb, `branches-${stamp()}.xlsx`);
}

export function downloadBranchesPdf(branches) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [
    ['Branch', 'Type', 'Org', 'Zone', 'Region', 'Devices', 'Up', 'Down', 'Up %', 'Status'],
  ];
  const body = (branches || []).map((b) => [
    b.branch ?? '',
    b.branchType ?? '',
    b.orgName ?? '',
    b.zone ?? '',
    b.region ?? '',
    b.deviceCount?.total ?? 0,
    b.deviceCount?.up ?? 0,
    b.deviceCount?.down ?? 0,
    b.deviceCount?.upPercentage ?? 0,
    b.branchStatus ?? '',
  ]);

  doc.setFontSize(12);
  doc.text(`Branch List (${body.length})`, 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`branches-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
