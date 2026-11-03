import React, { useMemo } from 'react';
import ChartExportCard from './ChartExportCard';

const MUTED = 'var(--muted, #64748b)';
const AXIS = 'var(--divider, #e2e8f0)';
const TYPE_COLORS = ['#8b5cf6', '#6366f1', '#0ea5e9', '#14b8a6', '#f97316', '#db2777', '#65a30d', '#64748b'];

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

function rowsOf(list, keyName) {
  return (list || [])
    .map((item) => ({
      name: String(item[keyName] ?? item.key ?? 'N/A'),
      count: Number(item.count) || 0,
    }))
    .filter((row) => row.count > 0);
}

function axisMax(peak) {
  const n = Math.max(0, Number(peak) || 0);
  if (n <= 1) return 4;
  if (n <= 3) return 6;
  return Math.ceil(n * 1.35);
}

function padCategories(rows, minSlots = 3) {
  if (rows.length >= minSlots) return rows;
  const missing = minSlots - rows.length;
  const left = Math.floor(missing / 2);
  const blanks = (count, prefix) =>
    Array.from({ length: count }, (_, i) => ({
      name: `${prefix}${i}`,
      count: null,
      spacer: true,
    }));
  return [...blanks(left, 'L'), ...rows, ...blanks(missing - left, 'R')];
}

export default function DevicePerformanceAlarmCharts({ charts, hostname, loading }) {
  const severityRows = useMemo(() => rowsOf(charts?.bySeverity, 'severity'), [charts]);
  const statusRows = useMemo(() => rowsOf(charts?.byStatus, 'status'), [charts]);
  const typeRows = useMemo(
    () => rowsOf(charts?.byType, 'type').slice(0, 8).reverse(),
    [charts]
  );

  const severityOption = useMemo(() => {
    if (!severityRows.length) return null;
    const total = severityRows.reduce((sum, row) => sum + row.count, 0);
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        left: 'center',
        textStyle: { color: MUTED, fontSize: 11 },
      },
      series: [
        {
          name: 'Severity',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: 'var(--surface-1, #fff)',
            borderWidth: 2,
          },
          label: { show: false },
          labelLine: { show: false },
          data: severityRows.map((row) => ({
            name: row.name,
            value: row.count,
            itemStyle: { color: severityColor(row.name) },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '38%',
          style: {
            text: String(total),
            fontSize: 18,
            fontWeight: 700,
            textAlign: 'center',
            fill: 'var(--text, #374151)',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '50%',
          style: {
            text: total === 1 ? 'alarm' : 'alarms',
            fontSize: 11,
            textAlign: 'center',
            fill: MUTED,
          },
        },
      ],
    };
  }, [severityRows]);

  const statusOption = useMemo(() => {
    if (!statusRows.length) return null;
    const padded = padCategories(statusRows, 3);
    const peak = Math.max(...statusRows.map((row) => row.count));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params.find((item) => item?.value != null) : params;
          if (p?.value == null) return '';
          return `${p.name}<br/><b>${p.value}</b>`;
        },
      },
      grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: padded.map((row) => row.name),
        axisTick: { show: false },
        axisLabel: {
          color: MUTED,
          fontSize: 11,
          formatter: (value, index) => (padded[index]?.spacer ? '' : value),
        },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: axisMax(peak),
        minInterval: 1,
        axisLabel: { color: MUTED, fontSize: 10 },
        splitLine: { lineStyle: { color: AXIS, type: 'dashed', opacity: 0.7 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Status',
          type: 'bar',
          barWidth: 18,
          data: padded.map((row) => (
            row.spacer
              ? null
              : {
                  value: row.count,
                  itemStyle: {
                    color: {
                      type: 'linear',
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: statusColor(row.name) },
                        { offset: 1, color: `${statusColor(row.name)}99` },
                      ],
                    },
                    borderRadius: [9, 9, 4, 4],
                  },
                }
          )),
          label: {
            show: true,
            position: 'top',
            color: 'var(--text, #334155)',
            fontSize: 11,
            fontWeight: 700,
            formatter: (p) => (p.value == null ? '' : p.value),
          },
        },
      ],
    };
  }, [statusRows]);

  const typeOption = useMemo(() => {
    if (!typeRows.length) return null;
    const padded = typeRows.length === 1
      ? [{ name: 'T0', count: null, spacer: true }, typeRows[0], { name: 'T1', count: null, spacer: true }]
      : typeRows;
    const peak = Math.max(...typeRows.map((row) => row.count));
    const track = axisMax(peak);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        formatter: (params) => {
          const p = (Array.isArray(params) ? params : [params])
            .find((item) => item?.seriesName === 'Type' && item?.value != null);
          if (!p) return '';
          return `${p.name}<br/><b>${p.value}</b>`;
        },
      },
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: track,
        minInterval: 1,
        axisLabel: { color: MUTED, fontSize: 10 },
        splitLine: { lineStyle: { color: AXIS, type: 'dashed', opacity: 0.7 } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        data: padded.map((row) => row.name),
        axisTick: { show: false },
        axisLabel: {
          color: MUTED,
          fontSize: 11,
          width: 64,
          overflow: 'truncate',
          formatter: (value, index) => (padded[index]?.spacer ? '' : value),
        },
        axisLine: { show: false },
      },
      series: [
        {
          name: 'Track',
          type: 'bar',
          barWidth: 10,
          barGap: '-100%',
          silent: true,
          tooltip: { show: false },
          data: padded.map((row) => (
            row.spacer
              ? null
              : { value: track, itemStyle: { color: 'rgba(148, 163, 184, 0.16)', borderRadius: 99 } }
          )),
          z: 1,
        },
        {
          name: 'Type',
          type: 'bar',
          barWidth: 10,
          z: 2,
          data: padded.map((row, i) => (
            row.spacer
              ? null
              : {
                  value: row.count,
                  itemStyle: {
                    color: TYPE_COLORS[(typeRows.length === 1 ? 0 : i) % TYPE_COLORS.length],
                    borderRadius: 99,
                  },
                }
          )),
          label: {
            show: true,
            position: 'right',
            color: 'var(--text, #334155)',
            fontSize: 11,
            fontWeight: 700,
            formatter: (p) => (p.value == null ? '' : p.value),
          },
        },
      ],
    };
  }, [typeRows]);

  return (
    <div className={`lp-health__charts lp-health__charts--three${loading ? ' is-loading' : ''}`}>
      <ChartExportCard
        title="By severity"
        option={severityOption}
        empty="No severity mix in this range"
        height={240}
        loading={loading}
        exportOpts={{
          hostname,
          metric: 'Severity',
          filePrefix: 'device-alarms',
          tableRows: severityRows.map((row) => ({ Severity: row.name, Count: row.count })),
        }}
      />
      <ChartExportCard
        title="By status"
        option={statusOption}
        empty="No status mix in this range"
        height={240}
        loading={loading}
        exportOpts={{
          hostname,
          metric: 'Status',
          filePrefix: 'device-alarms',
          tableRows: statusRows.map((row) => ({ Status: row.name, Count: row.count })),
        }}
      />
      <ChartExportCard
        title="By type"
        option={typeOption}
        empty="No alarm types in this range"
        height={240}
        loading={loading}
        exportOpts={{
          hostname,
          metric: 'Type',
          filePrefix: 'device-alarms',
          tableRows: [...typeRows].reverse().map((row) => ({ Type: row.name, Count: row.count })),
        }}
      />
    </div>
  );
}
