import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Maximize2, X } from 'lucide-react';
import '../../../styles/dash-panels.css';

/**
 * Grouped up/down bars for org / branch / zone / region wise stats.
 * Backend row shape: { [labelKey]: string, up, down, onboard, total, orgId?, branchId? }
 */
export default function GroupWiseDeviceStatus({
  title,
  rows = [],
  labelKey,
  filterParam,
  idKey,
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const data = Array.isArray(rows) ? rows : [];

  const labels = useMemo(
    () => data.map((d) => String(d?.[labelKey] || 'Unknown')),
    [data, labelKey]
  );
  const upData = useMemo(() => data.map((d) => Number(d?.up) || 0), [data]);
  const downData = useMemo(() => data.map((d) => Number(d?.down) || 0), [data]);

  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
      },
      grid: { left: 12, right: 12, top: 28, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: 'var(--muted, #64748b)',
          fontSize: 10,
          rotate: labels.length > 4 ? 25 : 0,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: 'var(--muted, #64748b)' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.25)' } },
      },
      series: [
        {
          name: 'Up',
          type: 'bar',
          stack: 'status',
          barMaxWidth: 36,
          data: upData,
          itemStyle: { color: '#22c55e' },
        },
        {
          name: 'Down',
          type: 'bar',
          stack: 'status',
          barMaxWidth: 36,
          data: downData,
          itemStyle: { color: '#ef4444' },
        },
      ],
    }),
    [labels, upData, downData]
  );

  const handleBarClick = (params) => {
    const status = String(params?.seriesName || '').toLowerCase();
    if (status !== 'up' && status !== 'down') return;

    const idx = typeof params.dataIndex === 'number' ? params.dataIndex : labels.indexOf(params.name);
    if (idx < 0 || idx >= data.length) return;

    const row = data[idx];
    const idVal = idKey ? row?.[idKey] : null;
    const labelVal = row?.[labelKey];

    const qs = new URLSearchParams({ status });
    if (idVal) qs.set(idKey, String(idVal));
    else if (labelVal && filterParam) qs.set(filterParam, String(labelVal));
    else return;

    navigate(`/live-performance?${qs.toString()}`);
  };

  return (
    <section className="dash-panel dash-panel--chart-center">
      <header className="dash-panel__head">
        <h3 className="dash-panel__title">{title}</h3>
        <button
          type="button"
          className="dash-panel__icon-btn"
          onClick={() => setOpen(true)}
          title="Fullscreen"
          aria-label={`Fullscreen ${title}`}
          disabled={!data.length}
        >
          <Maximize2 size={15} />
        </button>
      </header>

      <div className="dash-panel__body">
        {!data.length ? (
          <div className="dash-panel__empty">No data</div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: 240, width: '100%' }}
            opts={{ renderer: 'svg' }}
            onEvents={{ click: handleBarClick }}
          />
        )}
      </div>

      {open && data.length ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label={`${title} fullscreen`}>
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card">
            <header className="dash-panel__head">
              <h3 className="dash-panel__title">{title}</h3>
              <button type="button" className="dash-panel__icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            <ReactECharts
              option={option}
              style={{ height: 420, width: '100%' }}
              opts={{ renderer: 'svg' }}
              onEvents={{ click: handleBarClick }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
