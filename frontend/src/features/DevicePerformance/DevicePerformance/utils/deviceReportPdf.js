import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { statusLabel } from './format';
import { REPORT_SECTIONS, sectionTables } from './deviceReport';
import { stampFilename } from './tableExport';
import { chartsForReport } from './deviceReportCharts';

const NAVY = [15, 39, 68];
const TEAL = [13, 148, 136];
const SLATE = [71, 85, 105];
const HEADER_H = 46;
const FOOTER_H = 34;
const MARGIN_X = 36;

function rangeLabel(report) {
  const from = new Date((report.range?.from || 0) * 1000).toLocaleString();
  const to = new Date((report.range?.to || 0) * 1000).toLocaleString();
  return `${from}  →  ${to}`;
}

function drawHeader(doc, meta) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, HEADER_H, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, HEADER_H, w, 3, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SYSTROME NETWORKS', MARGIN_X, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NIMBUS SD-WAN  ·  Device Performance Report', MARGIN_X, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(meta.hostname || 'Device'), w - MARGIN_X, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(meta.period, w - MARGIN_X, 34, { align: 'right' });
}

function drawFooter(doc, page, pages, meta) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...NAVY);
  doc.rect(0, h - FOOTER_H, w, FOOTER_H, 'F');
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONFIDENTIAL', MARGIN_X, h - 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${meta.generated}`, 150, h - 14);
  doc.text(`Page ${page} of ${pages}`, w - MARGIN_X, h - 14, { align: 'right' });
}

function paintChrome(doc, meta) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    if (i === 1) {
      drawFooter(doc, i, pages, meta);
    } else {
      drawHeader(doc, meta);
      drawFooter(doc, i, pages, meta);
    }
  }
}

function contentTop() {
  return HEADER_H + 16;
}

function contentBottom(doc) {
  return doc.internal.pageSize.getHeight() - FOOTER_H - 12;
}

function ensureSpace(doc, y, need) {
  if (y + need <= contentBottom(doc)) return y;
  doc.addPage();
  return contentTop();
}

function sectionBanner(doc, y, title) {
  const w = doc.internal.pageSize.getWidth();
  const top = ensureSpace(doc, y, 28);
  doc.setFillColor(...TEAL);
  doc.roundedRect(MARGIN_X, top, w - MARGIN_X * 2, 20, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, MARGIN_X + 10, top + 14);
  return top + 28;
}

function addKvStrip(doc, y, pairs) {
  const w = doc.internal.pageSize.getWidth() - MARGIN_X * 2;
  const cols = Math.min(4, pairs.length || 1);
  const boxW = w / cols;
  const top = ensureSpace(doc, y, 44);
  pairs.slice(0, 8).forEach((pair, i) => {
    const x = MARGIN_X + (i % cols) * boxW;
    const rowY = top + Math.floor(i / cols) * 40;
    doc.setTextColor(...SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(pair[0] || '').toUpperCase(), x, rowY);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(pair[1] ?? '—').slice(0, 42), x, rowY + 14);
  });
  return top + Math.ceil(Math.min(pairs.length, 8) / cols) * 40 + 6;
}

function addCharts(doc, y, charts = []) {
  if (!charts.length) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN_X * 2;
  let cursor = y;
  for (let i = 0; i < charts.length; i += 2) {
    const left = charts[i];
    const right = charts[i + 1];
    const pair = Boolean(right);
    const imgH = pair ? 168 : 188;
    const imgW = pair ? (usable - 10) / 2 : usable;
    cursor = ensureSpace(doc, cursor, imgH + 22);
    const draw = (chart, x) => {
      if (!chart?.image) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(chart.title, x, cursor);
      try {
        doc.addImage(chart.image, 'PNG', x, cursor + 6, imgW, imgH);
      } catch {
        /* ignore broken image */
      }
    };
    draw(left, MARGIN_X);
    if (right) draw(right, MARGIN_X + imgW + 10);
    cursor += imgH + 22;
  }
  return cursor;
}

function addTable(doc, y, title, rows, empty) {
  const data = rows?.length ? rows : [{ Note: empty || 'No data in this range' }];
  const keys = Object.keys(data[0] || { Note: '' });
  let startY = ensureSpace(doc, y, 64);
  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(title, MARGIN_X, startY);
    startY += 8;
  }
  autoTable(doc, {
    startY,
    head: [keys],
    body: data.map((row) => keys.map((key) => row[key] ?? '')),
    margin: { left: MARGIN_X, right: MARGIN_X, top: HEADER_H + 12, bottom: FOOTER_H + 10 },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', textColor: [30, 41, 59] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
  });
  return (doc.lastAutoTable?.finalY || startY) + 16;
}

function drawCover(doc, report, meta) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const device = report.device || {};
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 168, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 168, w, 6, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SYSTROME NETWORKS', MARGIN_X, 42);
  doc.setTextColor(255);
  doc.setFontSize(26);
  doc.text('Device Performance Report', MARGIN_X, 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Nimbus SD-WAN Cloud  ·  Confidential operations brief', MARGIN_X, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(String(meta.hostname || 'Device'), MARGIN_X, 138);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(meta.period, MARGIN_X, 156);

  const facts = [
    ['Organization', device.orgName || device.org || '—'],
    ['Branch', device.branch || '—'],
    ['Model', device.model || '—'],
    ['Status', statusLabel(device.status)],
    ['Site ID', device.siteId || '—'],
    ['GUI IP', device.guiIp || '—'],
    ['Generated', meta.generated],
    ['Sections', (report.selected || []).length],
  ];
  let y = 196;
  y = addKvStrip(doc, y, facts);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('Report contents', MARGIN_X, y + 6);
  y += 20;
  (report.selected || []).forEach((id, i) => {
    const label = REPORT_SECTIONS.find((item) => item.id === id)?.label || id;
    doc.setFillColor(...TEAL);
    doc.circle(MARGIN_X + 5, y - 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(`${i + 1}.  ${label}`, MARGIN_X + 16, y);
    y += 16;
  });

  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text('This document is generated from live telemetry for the selected window. Chart series are downsampled for print.', MARGIN_X, h - 52);
}

export async function downloadDeviceReportPdf(report) {
  const meta = {
    hostname: report.hostname || report.device?.hostname || 'Device',
    period: rangeLabel(report),
    generated: new Date().toLocaleString(),
  };
  const charts = await chartsForReport(report);
  const tables = sectionTables(report);
  const titleMap = Object.fromEntries(REPORT_SECTIONS.map((item) => [item.id, item.label]));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  drawCover(doc, report, meta);

  for (const id of report.selected || []) {
    doc.addPage();
    let y = contentTop();
    y = sectionBanner(doc, y, titleMap[id] || id);
    y = addCharts(doc, y, charts[id] || []);
    const related = tables.filter((item) => {
      if (id === 'general') return item.id === 'general';
      if (id === 'usage') return String(item.id).startsWith('usage');
      if (id === 'links') return item.id === 'links' || item.id === 'radios';
      if (id === 'jobs') return String(item.id).startsWith('jobs');
      return item.id === id;
    });
    for (const table of related) {
      y = addTable(doc, y, table.title, table.rows, table.empty);
    }
    if (!(charts[id] || []).length && !related.length) {
      y = addTable(doc, y, '', [{ Note: 'No data in this range' }]);
    }
  }

  paintChrome(doc, meta);
  doc.save(stampFilename(`device-report-${meta.hostname}`, 'pdf'));
}
