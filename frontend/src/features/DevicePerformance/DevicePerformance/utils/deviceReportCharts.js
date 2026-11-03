import * as echarts from 'echarts';
import { axisTimeLabel, hexToRgba } from './chartTime';
import {
  formatMs,
  formatPercentLabel,
  packetAxisScale,
  rateAxisScale,
} from './format';

const MUTED = '#64748b';
const AXIS = '#cbd5e1';
const TEXT = '#334155';
const COLORS = ['#2563eb', '#f97316', '#0d9488', '#8b5cf6', '#ef4444', '#eab308', '#db2777', '#14b8a6'];

function downsample(series = [], maxPoints = 140) {
  if (!Array.isArray(series) || series.length <= maxPoints) return series || [];
  const step = Math.ceil(series.length / maxPoints);
  return series.filter((_, i) => i % step === 0 || i === series.length - 1);
}

function peakOf(series = []) {
  const values = series
    .map((point) => (Array.isArray(point) ? Number(point[1]) : Number(point)))
    .filter((n) => Number.isFinite(n));
  return values.length ? Math.max(...values) : 0;
}

function hasSeries(series) {
  return (series || []).some((point) => Number.isFinite(Number(point?.[1])));
}

function rangeMs(report, data) {
  const from = Number(data?.range?.from || report.range?.from) || 0;
  const to = Number(data?.range?.to || report.range?.to) || 0;
  return { fromMs: from * 1000, toMs: to * 1000 };
}

function yMaxFromPeak(peak, cap) {
  if (!peak) return 1;
  const next = peak * 1.15;
  return cap != null ? Math.min(cap, next) : next;
}

function lineArea(name, data, color) {
  return {
    name,
    type: 'line',
    data: downsample(data),
    smooth: 0.2,
    showSymbol: false,
    connectNulls: false,
    lineStyle: { color, width: 2 },
    itemStyle: { color },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: hexToRgba(color, 0.28) },
          { offset: 1, color: hexToRgba(color, 0.03) },
        ],
      },
    },
  };
}

function printLine({ series, fromMs, toMs, yFormat, yMax }) {
  return {
    animation: false,
    backgroundColor: '#ffffff',
    legend: {
      top: 2,
      textStyle: { color: MUTED, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { top: 32, right: 14, bottom: 22, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      min: fromMs,
      max: toMs,
      boundaryGap: false,
      axisLabel: {
        color: MUTED,
        fontSize: 10,
        hideOverlap: true,
        formatter: (value) => String(axisTimeLabel(value, fromMs, toMs)).replace('\n', ' '),
      },
      axisLine: { lineStyle: { color: AXIS } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yMax || yMaxFromPeak(Math.max(0, ...series.map((s) => peakOf(s.data)))),
      axisLabel: { color: MUTED, fontSize: 10, formatter: yFormat },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    series,
  };
}

function printBar({ labels, values, colors, horizontal = false }) {
  const cats = labels.map((name) => String(name || '—'));
  const data = values.map((value, i) => ({
    value,
    itemStyle: { color: colors[i % colors.length], borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] },
  }));
  const valueAxis = {
    type: 'value',
    min: 0,
    max: yMaxFromPeak(Math.max(0, ...values, 1)),
    minInterval: values.every((n) => Number.isInteger(n)) ? 1 : undefined,
    axisLabel: { color: MUTED, fontSize: 10 },
    splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
  };
  const catAxis = {
    type: 'category',
    data: cats,
    axisLabel: { color: MUTED, fontSize: 10, width: 72, overflow: 'truncate' },
    axisTick: { show: false },
    axisLine: { lineStyle: { color: AXIS } },
  };
  return {
    animation: false,
    backgroundColor: '#ffffff',
    grid: { top: 16, right: 16, bottom: 18, left: 8, containLabel: true },
    xAxis: horizontal ? valueAxis : catAxis,
    yAxis: horizontal ? catAxis : valueAxis,
    series: [{ type: 'bar', barMaxWidth: 22, data, label: { show: true, color: TEXT, fontSize: 10 } }],
  };
}

function printPie(rows, colorOf) {
  return {
    animation: false,
    backgroundColor: '#ffffff',
    legend: { bottom: 0, textStyle: { color: MUTED, fontSize: 10 } },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '46%'],
      label: { color: TEXT, fontSize: 10, formatter: '{b}\n{c}' },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      data: rows.map((row, i) => ({
        name: row.name,
        value: row.value,
        itemStyle: { color: colorOf ? colorOf(row.name, i) : COLORS[i % COLORS.length] },
      })),
    }],
  };
}

function severityColor(name) {
  const key = String(name || '').toLowerCase();
  if (key.includes('crit') || key === 'major') return '#ef4444';
  if (key.includes('warn') || key === 'minor') return '#f59e0b';
  if (key.includes('clear') || key === 'ok' || key === 'info') return '#22c55e';
  return '#64748b';
}

function statusColor(name) {
  const key = String(name || '').toLowerCase();
  if (/open|active/.test(key)) return '#f59e0b';
  if (/closed|cleared|resolved/.test(key)) return '#22c55e';
  return '#3b82f6';
}

function taskStatusColor(name) {
  const key = String(name || '').toLowerCase();
  if (key === 'success') return '#22c55e';
  if (key === 'failed') return '#ef4444';
  if (key === 'pending') return '#f59e0b';
  return '#64748b';
}

export function renderChartPng(option, { width = 920, height = 300 } = {}) {
  if (!option) return Promise.resolve('');
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = `width:${width}px;height:${height}px;position:fixed;left:-12000px;top:0;background:#fff;`;
    document.body.appendChild(el);
    const chart = echarts.init(el, null, { renderer: 'canvas', width, height, devicePixelRatio: 2 });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      let url = '';
      try {
        url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      } catch {
        url = '';
      }
      chart.dispose();
      el.remove();
      resolve(url);
    };
    chart.on('finished', finish);
    chart.setOption({ animation: false, ...option }, true);
    window.setTimeout(finish, 350);
  });
}

async function png(title, option, size) {
  const image = await renderChartPng(option, size);
  return image ? { title, image } : null;
}

export async function chartsForReport(report) {
  const out = {};
  const selected = report.selected || [];
  const byId = report.byId || {};

  if (selected.includes('health') && byId.health?.ok) {
    const data = byId.health.data || {};
    const { fromMs, toMs } = rangeMs(report, data);
    const cpu = data.historical?.cpu || [];
    const mem = data.historical?.memory || [];
    const items = [];
    if (hasSeries(cpu)) {
      items.push(await png('CPU utilization', printLine({
        fromMs,
        toMs,
        yMax: Math.min(100, yMaxFromPeak(peakOf(cpu), 100)),
        yFormat: (v) => `${Number(v).toFixed(1)}%`,
        series: [lineArea('CPU', cpu, '#2563eb')],
      })));
    }
    if (hasSeries(mem)) {
      items.push(await png('Memory utilization', printLine({
        fromMs,
        toMs,
        yMax: Math.min(100, yMaxFromPeak(peakOf(mem), 100)),
        yFormat: (v) => `${Number(v).toFixed(1)}%`,
        series: [lineArea('Memory', mem, '#f97316')],
      })));
    }
    out.health = items.filter(Boolean);
  }

  if (selected.includes('links') && byId.links?.ok) {
    const data = byId.links.data || {};
    const { fromMs, toMs } = rangeMs(report, data);
    const paths = data.paths || [];
    const items = [];
    if (paths.length) {
      items.push(await png('Probe uptime', printBar({
        labels: paths.map((row) => row.name),
        values: paths.map((row) => Number(row.uptimePercentage) || 0),
        colors: paths.map((row) => (row.lastStatus === 1 ? '#22c55e' : '#ef4444')),
      })));
    }
    const probe = paths.find((row) => hasSeries(row.latency?.series)) || paths[0];
    if (probe && hasSeries(probe.latency?.series)) {
      items.push(await png(`${probe.name} latency`, printLine({
        fromMs,
        toMs,
        yFormat: (v) => formatMs(v),
        series: [lineArea('Latency', probe.latency.series, '#2563eb')],
      })));
    }
    if (probe && hasSeries(probe.loss?.series)) {
      items.push(await png(`${probe.name} packet loss`, printLine({
        fromMs,
        toMs,
        yMax: Math.min(100, yMaxFromPeak(peakOf(probe.loss.series), 100)),
        yFormat: (v) => formatPercentLabel(v),
        series: [lineArea('Loss', probe.loss.series, '#ef4444')],
      })));
    }
    out.links = items.filter(Boolean);
  }

  if (selected.includes('interfaces') && byId.interfaces?.ok) {
    const ifaces = (byId.interfaces.data?.interfaces || []).slice(0, 10);
    const items = [];
    if (ifaces.length) {
      items.push(await png('Interface uptime', printBar({
        labels: ifaces.map((row) => row.name),
        values: ifaces.map((row) => Number(row.uptimePercentage) || 0),
        colors: ifaces.map((row) => (row.lastStatus === 1 ? '#22c55e' : '#ef4444')),
      })));
      items.push(await png('Interface traffic', printBar({
        horizontal: true,
        labels: ifaces.map((row) => row.name),
        values: ifaces.map((row) => Number(row.totals?.download || 0) + Number(row.totals?.upload || 0)),
        colors: COLORS,
      }), { width: 920, height: 340 }));
    }
    out.interfaces = items.filter(Boolean);
  }

  if (selected.includes('traffic') && byId.traffic?.ok) {
    const data = byId.traffic.data || {};
    const { fromMs, toMs } = rangeMs(report, data);
    const rx = data.dataPlane?.rx || [];
    const tx = data.dataPlane?.tx || [];
    const prx = data.managementPlane?.rx || [];
    const ptx = data.managementPlane?.tx || [];
    const ratePeak = Math.max(peakOf(rx), peakOf(tx));
    const pktPeak = Math.max(peakOf(prx), peakOf(ptx));
    const rateScale = rateAxisScale(ratePeak);
    const pktScale = packetAxisScale(pktPeak);
    const items = [];
    if (hasSeries(rx) || hasSeries(tx)) {
      items.push(await png('Data plane throughput', printLine({
        fromMs,
        toMs,
        yMax: yMaxFromPeak(ratePeak),
        yFormat: (v) => `${(Number(v) / rateScale.div).toFixed(1)} ${rateScale.suffix}`,
        series: [
          lineArea('Download RX', rx, '#0d9488'),
          lineArea('Upload TX', tx, '#2563eb'),
        ],
      })));
    }
    if (hasSeries(prx) || hasSeries(ptx)) {
      items.push(await png('Management plane packets', printLine({
        fromMs,
        toMs,
        yMax: yMaxFromPeak(pktPeak),
        yFormat: (v) => `${(Number(v) / pktScale.div).toFixed(1)} ${pktScale.suffix}`,
        series: [
          lineArea('Packets RX', prx, '#0d9488'),
          lineArea('Packets TX', ptx, '#f97316'),
        ],
      })));
    }
    out.traffic = items.filter(Boolean);
  }

  if (selected.includes('usage') && byId.usage?.ok) {
    const usage = byId.usage.data?.usage || {};
    const ips = byId.usage.data?.ips || [];
    const cats = Object.entries(usage.byCategory || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 8);
    const protos = (usage.protocols || []).filter((row) => Number(row.total) > 0).slice(0, 8);
    const items = [];
    if (cats.length) {
      items.push(await png('Usage by category', printBar({
        horizontal: true,
        labels: cats.map(([name]) => name),
        values: cats.map(([, total]) => Number(total) || 0),
        colors: COLORS,
      })));
    }
    if (protos.length) {
      items.push(await png('Usage by protocol', printPie(
        protos.map((row) => ({ name: row.name || 'Unknown', value: Number(row.total) || 0 })),
        (_name, i) => COLORS[i % COLORS.length]
      )));
    }
    const topIps = ips.filter((row) => Number(row.total) > 0).slice(0, 8);
    if (topIps.length) {
      items.push(await png('Usage by IP', printBar({
        horizontal: true,
        labels: topIps.map((row) => row.ip),
        values: topIps.map((row) => Number(row.total) || 0),
        colors: COLORS,
      })));
    }
    out.usage = items.filter(Boolean);
  }

  if (selected.includes('alarms') && byId.alarms?.ok) {
    const charts = byId.alarms.data?.charts || {};
    const sev = (charts.bySeverity || []).filter((row) => Number(row.count) > 0);
    const st = (charts.byStatus || []).filter((row) => Number(row.count) > 0);
    const types = (charts.byType || []).filter((row) => Number(row.count) > 0).slice(0, 8);
    const items = [];
    if (sev.length) {
      items.push(await png('Alarms by severity', printPie(
        sev.map((row) => ({ name: row.severity, value: row.count })),
        severityColor
      )));
    }
    if (st.length) {
      items.push(await png('Alarms by status', printBar({
        labels: st.map((row) => row.status),
        values: st.map((row) => row.count),
        colors: st.map((row) => statusColor(row.status)),
      })));
    }
    if (types.length) {
      items.push(await png('Alarms by type', printBar({
        horizontal: true,
        labels: types.map((row) => row.type),
        values: types.map((row) => row.count),
        colors: COLORS,
      })));
    }
    out.alarms = items.filter(Boolean);
  }

  if (selected.includes('logs') && byId.logs?.ok) {
    const logs = byId.logs.data?.logs || [];
    const counts = new Map();
    for (const row of logs) {
      const key = String(row.level || 'info');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const rows = [...counts.entries()].map(([name, value]) => ({ name, value }));
    out.logs = rows.length
      ? [(await png('Log levels', printPie(rows, severityColor)))].filter(Boolean)
      : [];
  }

  if (selected.includes('jobs') && byId.jobs?.ok) {
    const summary = byId.jobs.data?.summary || {};
    const rows = [
      { name: 'Success', value: Number(summary.success) || 0 },
      { name: 'Failed', value: Number(summary.failed) || 0 },
      { name: 'Pending', value: Number(summary.pending) || 0 },
    ].filter((row) => row.value > 0);
    out.jobs = rows.length
      ? [(await png('Task status', printPie(rows, taskStatusColor)))].filter(Boolean)
      : [];
  }

  return out;
}
