import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function zoneExportRows(zones) {
  return (zones || []).map((z) => ({
    Zone: z.zone ?? '',
    Organizations: Array.isArray(z.orgNames) ? z.orgNames.join(', ') : '',
    'Org Count': z.orgCount ?? 0,
    Regions: Array.isArray(z.regions) ? z.regions.join(', ') : '',
    'Region Count': z.regionCount ?? 0,
    Devices: z.deviceCount?.total ?? 0,
    Up: z.deviceCount?.up ?? 0,
    Down: z.deviceCount?.down ?? 0,
    'Up %': z.deviceCount?.upPercentage ?? 0,
    Status: z.status ?? '',
  }));
}

export function downloadZonesExcel(zones) {
  const rows = zoneExportRows(zones);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Zones');
  XLSX.writeFile(wb, `zones-${stamp()}.xlsx`);
}

export function downloadZonesPdf(zones) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [['Zone', 'Orgs', 'Regions', 'Devices', 'Up', 'Down', 'Up %', 'Status']];
  const body = (zones || []).map((z) => [
    z.zone ?? '',
    Array.isArray(z.orgNames) ? z.orgNames.join(', ') : '',
    Array.isArray(z.regions) ? z.regions.join(', ') : '',
    z.deviceCount?.total ?? 0,
    z.deviceCount?.up ?? 0,
    z.deviceCount?.down ?? 0,
    z.deviceCount?.upPercentage ?? 0,
    z.status ?? '',
  ]);

  doc.setFontSize(12);
  doc.text(`Zone List (${body.length})`, 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`zones-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
