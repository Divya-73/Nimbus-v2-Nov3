import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchDeviceDataUsage,
  fetchDeviceIpUsage,
} from '../../../../api/performance';
import { bytesAxisScale, formatBytesLabel, formatCount, formatPortLabel } from '../utils/format';
import {
  axisTimeLabel,
  formatPointTime,
  hexToRgba,
  useTimeRange,
} from '../utils/chartTime';
import ChartExportCard, { CHART_HEIGHT, PerfStat as Stat } from './ChartExportCard';
import TimeRangeToolbar from './TimeRangeToolbar';

const TOP_CATEGORIES = 8;
const TOP_CHART = 8;
const DOWNLOAD_COLOR = '#0d9488';
const UPLOAD_COLOR = '#2563eb';
const COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#f97316', '#db2777',
  '#65a30d', '#ea580c', '#0284c7', '#94a3b8',
];
const AXIS_LABEL = { color: 'var(--muted, #64748b)', fontSize: 10 };
const LEGEND = {
  textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
  itemWidth: 12,
  itemHeight: 8,
};

function stackedCategories(historical = [], byCategory = {}) {
  const ranked = Object.entries(byCategory)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([name]) => name);
  const top = ranked.slice(0, TOP_CATEGORIES);
  const topSet = new Set(top);
  const seriesByName = new Map((historical || []).map((item) => [item.name, item.data || []]));
  const times = [...new Set(
    (historical || []).flatMap((item) => (item.data || []).map((point) => Number(point[0])))
  )].filter(Number.isFinite).sort((a, b) => a - b);

  const valueAt = (name, ts) => {
    const row = (seriesByName.get(name) || []).find((point) => Number(point[0]) === ts);
    const n = Number(row?.[1]);
    return Number.isFinite(n) ? n : 0;
  };

  const lines = top.map((name, index) => ({
    name: name || 'Unknown',
    color: COLORS[index % COLORS.length],
    data: times.map((ts) => [ts, valueAt(name, ts)]),
  }));

  const otherNames = ranked.filter((name) => !topSet.has(name));
  if (otherNames.length) {
    lines.push({
      name: 'Other',
      color: COLORS[COLORS.length - 1],
      data: times.map((ts) => [
        ts,
        otherNames.reduce((sum, name) => sum + valueAt(name, ts), 0),
      ]),
    });
  }

  return lines.filter((line) => line.data.some((point) => point[1] > 0));
}

function stackedOption(lines, fromMs, toMs) {
  const peak = Math.max(
    0,
    ...((lines[0]?.data || []).map((_, i) =>
      lines.reduce((sum, line) => sum + Number(line.data?.[i]?.[1] || 0), 0)
    )),
  );
  const yMax = peak > 0 ? peak * 1.1 : 1;
  const scale = bytesAxisScale(peak);
  const xMin = Number.isFinite(Number(fromMs)) ? Number(fromMs) : undefined;
  const xMax = Number.isFinite(Number(toMs)) ? Number(toMs) : undefined;

  return {
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        if (!rows.length) return '';
        const ts = rows[0]?.value?.[0];
        const body = rows
          .filter((p) => Number(p?.value?.[1]) > 0)
          .map((p) => `<b>${p.seriesName}</b>: ${formatBytesLabel(p.value[1])}`);
        return `${formatPointTime(ts)}<br/>${body.join('<br/>')}`;
      },
    },
    grid: { top: 32, right: 12, bottom: 22, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      boundaryGap: false,
      axisLabel: {
        color: 'var(--muted, #64748b)',
        fontSize: 10,
        hideOverlap: true,
        formatter: (value) => axisTimeLabel(value, xMin, xMax),
      },
      axisLine: { lineStyle: { color: 'var(--divider, #e2e8f0)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yMax,
      axisLabel: {
        color: 'var(--muted, #64748b)',
        fontSize: 10,
        formatter: (value) => `${(Number(value) / scale.div).toFixed(2)} ${scale.suffix}`,
      },
      splitLine: { show: false },
    },
    series: lines.map((line) => ({
      name: line.name,
      type: 'line',
      stack: 'usage',
      data: line.data,
      smooth: 0.15,
      showSymbol: false,
      connectNulls: true,
      lineStyle: { width: 1.5, color: line.color },
      itemStyle: { color: line.color },
      areaStyle: { color: hexToRgba(line.color, 0.28) },
      emphasis: { focus: 'series' },
    })),
  };
}

function bytesTooltip(name, row) {
  const parts = [`<b>${name}</b>`, `Total: ${formatBytesLabel(row.total)}`];
  if (row.download != null) parts.push(`Download: ${formatBytesLabel(row.download)}`);
  if (row.upload != null) parts.push(`Upload: ${formatBytesLabel(row.upload)}`);
  if (row.flows != null) parts.push(`Flows: ${formatCount(row.flows)}`);
  if (row.mac) parts.push(`MAC: ${row.mac}`);
  if (row.proto) parts.push(`Protocol: ${row.proto}`);
  return parts.join('<br/>');
}

function donutOption(rows) {
  const data = (rows || []).filter((row) => Number(row.total) > 0);
  if (!data.length) return null;
  const total = data.reduce((sum, row) => sum + Number(row.total || 0), 0);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${bytesTooltip(p.name, p.data?.row || { total: p.value })}<br/>${p.percent}%`,
    },
    legend: { ...LEGEND, bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '62%'],
      center: ['50%', '46%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: 'var(--surface-1, #fff)', borderWidth: 2 },
      label: {
        color: 'var(--text, #0f172a)',
        fontSize: 11,
        formatter: (p) => `${p.name}\n${p.percent}%`,
      },
      data: data.map((row, index) => ({
        name: row.name || 'Unknown',
        value: Number(row.total) || 0,
        row,
        itemStyle: { color: COLORS[index % COLORS.length] },
      })),
    }],
    graphic: [{
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: formatBytesLabel(total),
        fill: 'var(--text, #0f172a)',
        fontSize: 12,
        fontWeight: 700,
        align: 'center',
      },
    }],
  };
}

function stackedBarOption(rows, labelOf) {
  const data = (rows || []).filter((row) => Number(row.total) > 0).slice(0, TOP_CHART);
  if (!data.length) return null;
  const labels = data.map(labelOf).reverse();
  const downloads = data.map((row) => Number(row.download) || 0).reverse();
  const uploads = data.map((row) => Number(row.upload) || 0).reverse();
  const peak = Math.max(1, ...data.map((row) => Number(row.total) || 0));
  const scale = bytesAxisScale(peak);
  const byLabel = Object.fromEntries(data.map((row) => [labelOf(row), row]));
  return {
    legend: { ...LEGEND, top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        const name = rows[0]?.axisValue;
        return bytesTooltip(name, byLabel[name] || { total: 0 });
      },
    },
    grid: { top: 24, right: 10, bottom: 4, left: 4, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (value) => `${(Number(value) / scale.div).toFixed(1)} ${scale.suffix}`,
      },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: 'var(--divider, #e2e8f0)' } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: { ...AXIS_LABEL, fontSize: 11 },
      axisLine: { lineStyle: { color: 'var(--divider, #e2e8f0)' } },
      splitLine: { show: false },
    },
    series: [
      {
        name: 'Download',
        type: 'bar',
        stack: 'bytes',
        barWidth: 11,
        data: downloads,
        itemStyle: { color: DOWNLOAD_COLOR, borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'Upload',
        type: 'bar',
        stack: 'bytes',
        barWidth: 11,
        data: uploads,
        itemStyle: { color: UPLOAD_COLOR, borderRadius: [0, 6, 6, 0] },
      },
    ],
  };
}

function groupedBarOption(rows) {
  const data = (rows || []).filter((row) => Number(row.total) > 0).slice(0, TOP_CHART);
  if (!data.length) return null;
  const labels = data.map((row) => row.ip || 'Unknown');
  const peak = Math.max(1, ...data.flatMap((row) => [Number(row.download) || 0, Number(row.upload) || 0]));
  const scale = bytesAxisScale(peak);
  const byIp = Object.fromEntries(data.map((row) => [row.ip, row]));
  return {
    legend: { ...LEGEND, top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        const ip = rows[0]?.axisValue;
        return bytesTooltip(ip, byIp[ip] || { total: 0 });
      },
    },
    grid: { top: 24, right: 8, bottom: 36, left: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        ...AXIS_LABEL,
        rotate: 28,
        hideOverlap: true,
        formatter: (value) => (String(value).length > 16 ? `${String(value).slice(0, 14)}…` : value),
      },
      axisLine: { lineStyle: { color: 'var(--divider, #e2e8f0)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (value) => `${(Number(value) / scale.div).toFixed(1)} ${scale.suffix}`,
      },
      splitLine: { show: false },
    },
    series: [
      {
        name: 'Download',
        type: 'bar',
        barGap: '20%',
        barMaxWidth: 14,
        data: data.map((row) => Number(row.download) || 0),
        itemStyle: { color: DOWNLOAD_COLOR, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Upload',
        type: 'bar',
        barMaxWidth: 14,
        data: data.map((row) => Number(row.upload) || 0),
        itemStyle: { color: UPLOAD_COLOR, borderRadius: [5, 5, 0, 0] },
      },
    ],
  };
}

function usageTableRows(rows, labelOf) {
  return (rows || [])
    .filter((row) => Number(row.total) > 0)
    .map((row) => ({
      Name: labelOf(row),
      Download: formatBytesLabel(row.download),
      Upload: formatBytesLabel(row.upload),
      Total: formatBytesLabel(row.total),
      Flows: row.flows != null ? formatCount(row.flows) : undefined,
      MAC: row.mac || undefined,
      Protocol: row.proto || undefined,
    }))
    .map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value != null)));
}

export default function DevicePerformanceUsage({ deviceId, refreshKey }) {
  const {
    preset,
    range,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    rangeError,
    applyPreset,
    applyRange,
    presetLabel,
  } = useTimeRange('1h');
  const [usage, setUsage] = useState(null);
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [nextUsage, nextIps] = await Promise.all([
          fetchDeviceDataUsage(deviceId, range),
          fetchDeviceIpUsage(deviceId, range),
        ]);
        if (!alive) return;
        setUsage(nextUsage);
        setIps(Array.isArray(nextIps?.ips) ? nextIps.ips : []);
      } catch (err) {
        if (alive) {
          setUsage(null);
          setIps([]);
          setError(err.message || 'Failed to load usage');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceId, refreshKey, range]);

  const fromMs = (usage?.range?.from || range?.from) * 1000;
  const toMs = (usage?.range?.to || range?.to) * 1000;
  const lines = useMemo(
    () => stackedCategories(usage?.historical?.bytes || [], usage?.byCategory || {}),
    [usage]
  );
  const option = useMemo(() => stackedOption(lines, fromMs, toMs), [lines, fromMs, toMs]);

  const totalBytes = Number(usage?.total?.bytes) || 0;
  const hasData = totalBytes > 0
    || ips.length > 0
    || (usage?.protocols || []).length > 0
    || (usage?.ports || []).length > 0;
  const hostname = usage?.hostname || deviceId;
  const exportBase = {
    hostname,
    fromMs,
    toMs,
    filePrefix: 'device-usage',
    formatValue: formatBytesLabel,
    note: 'bytes used in selected range',
  };
  const protocolRows = usageTableRows(usage?.protocols, (row) => row.name || 'Unknown');
  const portRows = usageTableRows(usage?.ports, (row) => formatPortLabel(row.port));
  const ipRows = usageTableRows(ips, (row) => row.ip || 'Unknown');

  const protocolOption = useMemo(() => donutOption(usage?.protocols || []), [usage]);
  const portOption = useMemo(
    () => stackedBarOption(usage?.ports || [], (row) => formatPortLabel(row.port)),
    [usage]
  );
  const ipOption = useMemo(() => groupedBarOption(ips), [ips]);

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            This is <strong>how much data was used</strong> in the selected range,
            by category, protocol, IP, and port — not live speed (that is the Traffic tab).
            Hover a chart for download, upload, and flow counts.
            {hasData ? <> Total <strong>{formatBytesLabel(totalBytes)}</strong>.</> : null}
          </>
        )}
        rangeAriaLabel="Data usage time range"
        preset={preset}
        applyPreset={applyPreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        applyRange={applyRange}
        rangeError={rangeError}
        loading={loading}
      />

      {error ? <p className="dl-error">{error}</p> : null}
      {loading && !usage ? <div className="dl-empty">Loading data usage…</div> : null}

      {usage ? (
        hasData ? (
          <>
            <div className="lp-health__stat-row-grid lp-usage-stats">
              <Stat label="Total data" value={formatBytesLabel(usage.total?.bytes)} />
              <Stat label="Download" value={formatBytesLabel(usage.total?.download)} />
              <Stat label="Upload" value={formatBytesLabel(usage.total?.upload)} />
              <Stat label="Flows" value={formatCount(usage.total?.records)} />
              <Stat label="Packets" value={formatCount(usage.total?.packets)} />
              <Stat label="Destinations" value={formatCount(usage.total?.destinations ?? ips.length)} />
            </div>

            <div className={`lp-usage__charts${loading ? ' is-loading' : ''}`}>
              <ChartExportCard
                title="Protocols"
                option={protocolOption}
                empty="No protocol usage in this range"
                loading={loading}
                exportOpts={{ ...exportBase, metric: 'Protocols', tableRows: protocolRows }}
              />
              <ChartExportCard
                title="Service ports"
                option={portOption}
                empty="No port usage in this range"
                loading={loading}
                exportOpts={{ ...exportBase, metric: 'Service ports', tableRows: portRows }}
              />
              <ChartExportCard
                title="IP addresses"
                option={ipOption}
                empty="No IP usage in this range"
                loading={loading}
                wide
                exportOpts={{ ...exportBase, metric: 'IP addresses', tableRows: ipRows }}
              />
            </div>

            <ChartExportCard
              title="Data usage by category"
              option={lines.length ? option : null}
              empty="No category breakdown in this range"
              loading={loading}
              wide
              height={CHART_HEIGHT}
              exportOpts={{
                ...exportBase,
                metric: 'Data usage by category',
                seriesList: lines,
                series: lines[0]?.data,
                note: 'bytes used by category',
              }}
            />
          </>
        ) : (
          <div className="dl-empty">
            No data usage records in the last {presetLabel.toLowerCase()}
          </div>
        )
      ) : null}
    </div>
  );
}
