import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function listJoin(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

export function modelExportRows(models) {
  return (models || []).map((m) => ({
    Model: m.model ?? '',
    Manufacturer: m.manufacturer ?? '',
    Version: m.version ?? '',
    Organizations: listJoin(m.orgNames),
    'Org Count': m.orgCount ?? 0,
    Zones: listJoin(m.zones),
    'Zone Count': m.zoneCount ?? 0,
    Regions: listJoin(m.regions),
    'Region Count': m.regionCount ?? 0,
    WAN: listJoin(m.wan),
    SIM: listJoin(m.sim),
    LAN: m.lan ?? '',
    SSTP: m.sstp ?? '',
    Devices: m.deviceCount?.total ?? 0,
    Up: m.deviceCount?.up ?? 0,
    Down: m.deviceCount?.down ?? 0,
    'Up %': m.deviceCount?.upPercentage ?? 0,
    Status: m.status ?? '',
  }));
}

export function downloadModelsExcel(models) {
  const rows = modelExportRows(models);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Models');
  XLSX.writeFile(wb, `models-${stamp()}.xlsx`);
}

export function downloadModelsPdf(models) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [
    ['Model', 'Manufacturer', 'Orgs', 'Zones', 'Regions', 'Devices', 'Up', 'Down', 'Up %', 'Status'],
  ];
  const body = (models || []).map((m) => [
    m.model ?? '',
    m.manufacturer ?? '',
    listJoin(m.orgNames),
    listJoin(m.zones),
    listJoin(m.regions),
    m.deviceCount?.total ?? 0,
    m.deviceCount?.up ?? 0,
    m.deviceCount?.down ?? 0,
    m.deviceCount?.upPercentage ?? 0,
    m.status ?? '',
  ]);

  doc.setFontSize(12);
  doc.text(`Model List (${body.length})`, 40, 32);
  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`models-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
