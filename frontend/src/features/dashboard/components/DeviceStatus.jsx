import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import '../../../styles/dash-panels.css';

export default function DeviceStatusChart({ stats }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const up = stats?.deviceStatus?.up || 0;
  const down = stats?.deviceStatus?.down || 0;
  const onboard = stats?.deviceStatus?.onboard || 0;

  const option = useMemo(
    () => ({
      legend: {
        bottom: 0,
        textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
      },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          label: {
            formatter: '{b}\n{c}',
            fontSize: 11,
            color: 'var(--text, #0f172a)',
          },
          data: [
            { value: up, name: 'Up', itemStyle: { color: '#22c55e' } },
            { value: down, name: 'Down', itemStyle: { color: '#ef4444' } },
            { value: onboard, name: 'Onboard', itemStyle: { color: '#a855f7' } },
          ],
        },
      ],
    }),
    [up, down, onboard]
  );

  const onChartClick = (params) => {
    const name = String(params?.name || '').toLowerCase();
    if (name === 'onboard') {
      navigate('/provisioning/onboard');
      return;
    }
    if (name === 'up' || name === 'down') {
      navigate(`/live-performance?status=${name}`);
    }
  };

  return (
    <section className="dash-panel">
      <header className="dash-panel__head">
        <h3 className="dash-panel__title">Device Status</h3>
        <button
          type="button"
          className="dash-panel__icon-btn"
          onClick={() => setOpen(true)}
          title="Fullscreen chart"
          aria-label="Fullscreen chart"
        >
          <Maximize2 size={15} />
        </button>
      </header>

      <ReactECharts
        option={option}
        style={{ height: 220 }}
        opts={{ renderer: 'svg' }}
        onEvents={{ click: onChartClick }}
      />

      {open ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="Device Status fullscreen">
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card dash-modal__card--chart">
            <header className="dash-panel__head">
              <h3 className="dash-panel__title">Device Status</h3>
              <button
                type="button"
                className="dash-panel__icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close chart"
              >
                <X size={16} />
              </button>
            </header>
            <ReactECharts
              option={option}
              style={{ height: 420, width: '100%' }}
              opts={{ renderer: 'svg' }}
              onEvents={{ click: onChartClick }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
