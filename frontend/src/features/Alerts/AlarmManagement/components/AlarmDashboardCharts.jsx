import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

function mapSeverityKey(raw) {
  const key = String(raw ?? '').toLowerCase().trim();
  if (key === 'critical' || key === 'crit' || key === 'major') return 'critical';
  if (key === 'warning' || key === 'warn' || key === 'minor') return 'warning';
  if (key === 'cleared' || key === 'clear' || key === 'ok' || key === 'info') return 'cleared';
  return null;
}

function chartTextColor() {
  return 'var(--muted, #64748b)';
}

function chartAxisColor() {
  return 'var(--divider, #e2e8f0)';
}

export default function AlarmDashboardCharts({ stats, loading, error }) {
  const severityCounts = useMemo(() => {
    const next = { critical: 0, warning: 0, cleared: 0 };
    (stats?.bySeverity || []).forEach((b) => {
      const mapped = mapSeverityKey(b.severity ?? b.key);
      if (mapped) next[mapped] += Number(b.count) || 0;
    });
    return next;
  }, [stats]);

  const severityTotal =
    severityCounts.critical + severityCounts.warning + severityCounts.cleared;
  const clearedPct = severityTotal
    ? Math.round((severityCounts.cleared / severityTotal) * 100)
    : 0;

  const statusRows = useMemo(
    () =>
      (stats?.byStatus || []).map((b) => ({
        name: String(b.status ?? b.key ?? '—'),
        count: Number(b.count) || 0,
      })),
    [stats]
  );

  const typeRows = useMemo(
    () =>
      (stats?.byType || [])
        .slice(0, 8)
        .map((b) => ({
          name: String(b.type ?? b.key ?? '—'),
          count: Number(b.count) || 0,
        }))
        .reverse(),
    [stats]
  );

  const trendRows = useMemo(
    () =>
      (stats?.recentTrend || []).map((b) => ({
        date: String(b.date ?? ''),
        count: Number(b.count) || 0,
      })),
    [stats]
  );

  const openCount = statusRows
    .filter((r) => /open|active/i.test(r.name))
    .reduce((sum, r) => sum + r.count, 0);
  const closedCount = statusRows
    .filter((r) => /closed|cleared|resolved/i.test(r.name))
    .reduce((sum, r) => sum + r.count, 0);
  const totalAlarms = statusRows.reduce((sum, r) => sum + r.count, 0) || severityTotal;

  const severityOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'horizontal',
        bottom: 4,
        left: 'center',
        data: ['Critical', 'Warning', 'Cleared'],
        textStyle: { color: chartTextColor(), fontSize: 11 },
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '38%',
          style: {
            text: `Cleared\n${clearedPct}%`,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 18,
            textAlign: 'center',
            fill: 'var(--text, #374151)',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '54%',
          style: {
            text: `Total: ${severityTotal}`,
            fontSize: 11,
            fill: chartTextColor(),
            textAlign: 'center',
          },
        },
      ],
      series: [
        {
          name: 'Severity',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: 'var(--surface-1, #fff)',
            borderWidth: 2,
          },
          label: { show: false },
          labelLine: { show: false },
          data: [
            {
              value: severityCounts.critical,
              name: 'Critical',
              itemStyle: { color: '#ef4444' },
            },
            {
              value: severityCounts.warning,
              name: 'Warning',
              itemStyle: { color: '#f59e0b' },
            },
            {
              value: severityCounts.cleared,
              name: 'Cleared',
              itemStyle: { color: '#22c55e' },
            },
          ],
        },
      ],
    }),
    [clearedPct, severityCounts, severityTotal]
  );

  const statusOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 40, right: 16, top: 24, bottom: 32 },
      xAxis: {
        type: 'category',
        data: statusRows.map((r) => r.name),
        axisLabel: { color: chartTextColor(), fontSize: 11 },
        axisLine: { lineStyle: { color: chartAxisColor() } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: chartTextColor(), fontSize: 11 },
        splitLine: { lineStyle: { color: chartAxisColor(), type: 'dashed' } },
      },
      series: [
        {
          name: 'Alarms',
          type: 'bar',
          barMaxWidth: 36,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: '#3b82f6',
          },
          data: statusRows.map((r) => {
            const key = r.name.toLowerCase();
            let color = '#3b82f6';
            if (/open|active/.test(key)) color = '#f59e0b';
            if (/closed|cleared|resolved/.test(key)) color = '#22c55e';
            return { value: r.count, itemStyle: { color } };
          }),
        },
      ],
    }),
    [statusRows]
  );

  const typeOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 88, right: 16, top: 16, bottom: 24 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: chartTextColor(), fontSize: 11 },
        splitLine: { lineStyle: { color: chartAxisColor(), type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: typeRows.map((r) => r.name),
        axisLabel: { color: chartTextColor(), fontSize: 10, width: 72, overflow: 'truncate' },
        axisLine: { lineStyle: { color: chartAxisColor() } },
      },
      series: [
        {
          name: 'Type',
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: '#8b5cf6',
          },
          data: typeRows.map((r) => r.count),
        },
      ],
    }),
    [typeRows]
  );

  const trendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: 24, bottom: 36 },
      xAxis: {
        type: 'category',
        data: trendRows.map((r) => r.date),
        axisLabel: { color: chartTextColor(), fontSize: 10 },
        axisLine: { lineStyle: { color: chartAxisColor() } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: chartTextColor(), fontSize: 11 },
        splitLine: { lineStyle: { color: chartAxisColor(), type: 'dashed' } },
      },
      series: [
        {
          name: 'Alarms',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#0ea5e9' },
          itemStyle: { color: '#0ea5e9' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14, 165, 233, 0.28)' },
                { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
              ],
            },
          },
          data: trendRows.map((r) => r.count),
        },
      ],
    }),
    [trendRows]
  );

  return (
    <>
      <div className="alarm-dash-kpis" aria-label="Alarm summary">
        <div className="alarm-dash-kpi">
          <span className="alarm-dash-kpi__label">Total</span>
          <strong className="alarm-dash-kpi__value">{loading ? '—' : totalAlarms}</strong>
        </div>
        <div className="alarm-dash-kpi alarm-dash-kpi--crit">
          <span className="alarm-dash-kpi__label">Critical</span>
          <strong className="alarm-dash-kpi__value">
            {loading ? '—' : severityCounts.critical}
          </strong>
        </div>
        <div className="alarm-dash-kpi alarm-dash-kpi--warn">
          <span className="alarm-dash-kpi__label">Open</span>
          <strong className="alarm-dash-kpi__value">{loading ? '—' : openCount}</strong>
        </div>
        <div className="alarm-dash-kpi alarm-dash-kpi--ok">
          <span className="alarm-dash-kpi__label">Closed</span>
          <strong className="alarm-dash-kpi__value">{loading ? '—' : closedCount}</strong>
        </div>
      </div>

      {error ? <p className="dl-error">{error}</p> : null}

      <div className="dash-panels dash-panels--three alarm-dash-charts">
        <section className="dash-panel dash-panel--chart-center">
          <header className="dash-panel__head">
            <h3 className="dash-panel__title">Severity</h3>
            <p className="dash-panel__meta">By severity level</p>
          </header>
          <div className="dash-panel__body">
            {loading ? <div className="dash-panel__empty">Loading…</div> : null}
            {!loading && !severityTotal ? (
              <div className="dash-panel__empty">No severity data</div>
            ) : null}
            {!loading && severityTotal ? (
              <ReactECharts
                option={severityOption}
                style={{ height: 240, width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </div>
        </section>

        <section className="dash-panel dash-panel--chart-center">
          <header className="dash-panel__head">
            <h3 className="dash-panel__title">Status</h3>
            <p className="dash-panel__meta">Open vs closed</p>
          </header>
          <div className="dash-panel__body">
            {loading ? <div className="dash-panel__empty">Loading…</div> : null}
            {!loading && !statusRows.length ? (
              <div className="dash-panel__empty">No status data</div>
            ) : null}
            {!loading && statusRows.length ? (
              <ReactECharts
                option={statusOption}
                style={{ height: 240, width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </div>
        </section>

        <section className="dash-panel dash-panel--chart-center">
          <header className="dash-panel__head">
            <h3 className="dash-panel__title">Top types</h3>
            <p className="dash-panel__meta">Most frequent alarm types</p>
          </header>
          <div className="dash-panel__body">
            {loading ? <div className="dash-panel__empty">Loading…</div> : null}
            {!loading && !typeRows.length ? (
              <div className="dash-panel__empty">No type data</div>
            ) : null}
            {!loading && typeRows.length ? (
              <ReactECharts
                option={typeOption}
                style={{ height: 240, width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </div>
        </section>
      </div>

      <div className="dash-panels alarm-dash-trend">
        <section className="dash-panel">
          <header className="dash-panel__head">
            <h3 className="dash-panel__title">Alarm trend</h3>
            <p className="dash-panel__meta">Daily volume for current filters</p>
          </header>
          <div className="dash-panel__body">
            {loading ? <div className="dash-panel__empty">Loading…</div> : null}
            {!loading && !trendRows.length ? (
              <div className="dash-panel__empty">No trend data</div>
            ) : null}
            {!loading && trendRows.length ? (
              <ReactECharts
                option={trendOption}
                style={{ height: 220, width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
