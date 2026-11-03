import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Maximize2, X } from 'lucide-react';
import '../../../styles/dash-panels.css';

export default function LanLteStatus({ stats }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleBarClick = (params) => {
    const status = String(params.seriesName || '').toLowerCase();
    let param = '';
    if (params.name === 'LTE1') param = 'lte1Status';
    else if (params.name === 'LTE2') param = 'lte2Status';
    else if (params.name === 'LAN') param = 'lanStatus';
    if (param && (status === 'up' || status === 'down')) {
      navigate(`/live-performance?${param}=${status}`);
    }
  };

  const option = useMemo(
    () => ({
      legend: {
        bottom: 4,
        left: 'center',
        textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
      },
      tooltip: { trigger: 'axis' },
      grid: { top: 28, bottom: 44, left: 36, right: 16, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['LTE1', 'LTE2', 'LAN'],
        axisLabel: { color: 'var(--muted, #64748b)' },
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
          barMaxWidth: 34,
          barGap: '20%',
          barCategoryGap: '35%',
          data: [stats?.lte1?.up || 0, stats?.lte2?.up || 0, stats?.lan?.up || 0],
          itemStyle: { color: '#22c55e' },
        },
        {
          name: 'Down',
          type: 'bar',
          barMaxWidth: 34,
          data: [stats?.lte1?.down || 0, stats?.lte2?.down || 0, stats?.lan?.down || 0],
          itemStyle: { color: '#ef4444' },
        },
      ],
    }),
    [stats]
  );

  return (
    <section className="dash-panel dash-panel--chart-center">
      <header className="dash-panel__head">
        <h3 className="dash-panel__title">LTE / LAN Status</h3>
        <button
          type="button"
          className="dash-panel__icon-btn"
          onClick={() => setOpen(true)}
          title="Fullscreen"
          aria-label="Fullscreen LTE/LAN chart"
        >
          <Maximize2 size={15} />
        </button>
      </header>

      <div className="dash-panel__body">
        <ReactECharts
          className="dash-panel__chart--compact"
          option={option}
          style={{ height: 240, width: '100%', maxWidth: 280 }}
          opts={{ renderer: 'svg' }}
          onEvents={{ click: handleBarClick }}
        />
      </div>

      {open ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="LTE LAN fullscreen">
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card">
            <header className="dash-panel__head">
              <h3 className="dash-panel__title">LTE / LAN Status</h3>
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
