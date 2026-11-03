import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Maximize2, X } from 'lucide-react';
import { fetchUptimeTrend } from '../../../api/dashboard';
import '../../../styles/dash-panels.css';

function formatDownFor(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function TimeWiseDeviceStatus() {
  const [buckets, setBuckets] = useState([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetchUptimeTrend();
        if (!alive) return;
        // New API: { buckets, total }. Old API: { windows } (pre-downtime buckets).
        const nextBuckets = Array.isArray(res?.buckets)
          ? res.buckets
          : Array.isArray(res?.windows)
            ? res.windows.map((w) => ({
                key: w.key,
                label: w.label,
                count: Number(w.down) || 0,
                devices: [],
              }))
            : [];
        setBuckets(nextBuckets);
        setTotal(
          Number(res?.total) ||
            nextBuckets.reduce((n, b) => n + (Number(b.count) || 0), 0)
        );
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Failed to load downtime status');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const labels = useMemo(() => buckets.map((b) => b.label), [buckets]);
  const values = useMemo(() => buckets.map((b) => b.count), [buckets]);
  const colors = useMemo(
    () => buckets.map((b) => (b.key === 'up' ? '#22c55e' : '#ef4444')),
    [buckets]
  );

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p?.name || ''}: <b>${p?.value ?? 0}</b>`;
        },
      },
      grid: { top: 8, right: 28, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: 'var(--muted, #64748b)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.25)' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        inverse: true,
        axisLabel: { color: 'var(--text, #0f172a)', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i], borderRadius: [0, 3, 3, 0] },
          })),
          barMaxWidth: 14,
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: 'var(--muted, #64748b)',
            formatter: ({ value }) => (value > 0 ? value : ''),
          },
        },
      ],
    }),
    [labels, values, colors]
  );

  const onBarClick = (params) => {
    const idx = params?.dataIndex;
    if (idx == null || !buckets[idx]) return;
    setSelected(buckets[idx]);
  };

  const chartHeight = Math.max(220, buckets.length * 22 + 24);

  return (
    <section className="dash-panel">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Device Up/Down Status</h3>
          {!loading && !err ? (
            <p className="dash-panel__meta">Downtime by duration · {total} assigned</p>
          ) : null}
        </div>
        <button
          type="button"
          className="dash-panel__icon-btn"
          onClick={() => setOpen(true)}
          title="Fullscreen"
          aria-label="Fullscreen downtime chart"
          disabled={loading || !!err || !buckets.length}
        >
          <Maximize2 size={15} />
        </button>
      </header>

      {loading ? <div className="dash-panel__empty">Loading downtime…</div> : null}
      {err ? <div className="dash-panel__error">{err}</div> : null}
      {!loading && !err && !buckets.length ? <div className="dash-panel__empty">No device data</div> : null}
      {!loading && !err && buckets.length ? (
        <ReactECharts
          option={option}
          style={{ height: chartHeight }}
          opts={{ renderer: 'svg' }}
          onEvents={{ click: onBarClick }}
        />
      ) : null}

      {open ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="Downtime fullscreen">
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card">
            <header className="dash-panel__head">
              <h3 className="dash-panel__title">Device Up/Down Status</h3>
              <button type="button" className="dash-panel__icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            <ReactECharts
              option={option}
              style={{ height: Math.max(420, buckets.length * 28 + 40), width: '100%' }}
              opts={{ renderer: 'svg' }}
              onEvents={{ click: onBarClick }}
            />
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="Devices in bucket">
          <button type="button" className="dash-modal__backdrop" onClick={() => setSelected(null)} aria-label="Close" />
          <div className="dash-modal__card dash-modal__card--devices">
            <header className="dash-panel__head">
              <div>
                <h3 className="dash-panel__title">{selected.label}</h3>
                <p className="dash-panel__meta">{selected.count} device{selected.count === 1 ? '' : 's'}</p>
              </div>
              <button type="button" className="dash-panel__icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            {!selected.devices?.length ? (
              <div className="dash-panel__empty" style={{ minHeight: 80 }}>
                No devices in this bucket
              </div>
            ) : (
              <div className="downtime-device-list">
                <table>
                  <thead>
                    <tr>
                      <th>Hostname</th>
                      <th>Organization</th>
                      <th>Zone</th>
                      <th>Region</th>
                      <th>Down for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.devices.map((d, i) => (
                      <tr key={`${d.hostname}-${i}`}>
                        <td>{d.hostname}</td>
                        <td>{d.organization || '—'}</td>
                        <td>{d.zone || '—'}</td>
                        <td>{d.region || '—'}</td>
                        <td>
                          {selected.key === 'up' ? '—' : formatDownFor(d.downForSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
