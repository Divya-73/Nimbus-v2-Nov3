import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Maximize2, X } from 'lucide-react';
import { fetchAlarmStats } from '../../../api/dashboard';
import '../../../styles/dash-panels.css';

function mapSeverityKey(raw) {
  const key = String(raw ?? '').toLowerCase().trim();
  if (key === 'critical' || key === 'crit' || key === 'major') return 'critical';
  if (key === 'warning' || key === 'warn' || key === 'minor') return 'warning';
  if (key === 'cleared' || key === 'clear' || key === 'ok' || key === 'info') return 'cleared';
  return null;
}

export default function AlarmSeverity({ variant = 'donut' }) {
  const [counts, setCounts] = useState({ critical: 0, warning: 0, cleared: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const stats = await fetchAlarmStats();
        if (!alive) return;
        const next = { critical: 0, warning: 0, cleared: 0 };
        (stats?.bySeverity || []).forEach((b) => {
          const mapped = mapSeverityKey(b.severity ?? b.key);
          if (mapped) next[mapped] += Number(b.count) || 0;
        });
        setCounts(next);
      } catch (e) {
        if (!alive) return;
        setError(e.message || 'Failed to load severity stats');
        setCounts({ critical: 0, warning: 0, cleared: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isSemi = variant === 'semi';
  const total = counts.critical + counts.warning + counts.cleared;
  const clearedPct = total ? Math.round((counts.cleared / total) * 100) : 0;

  const option = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'horizontal',
        bottom: 4,
        left: 'center',
        data: ['Critical', 'Warning', 'Cleared'],
        textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: isSemi ? '35%' : '40%',
          style: {
            text: `Cleared\n${clearedPct}%`,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 20,
            textAlign: 'center',
            fill: 'var(--text, #374151)',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: isSemi ? '56%' : '54%',
          style: {
            text: `Total: ${total}`,
            fontSize: 11,
            fill: 'var(--muted, #6b7280)',
            textAlign: 'center',
          },
        },
      ],
      series: [
        {
          name: 'Severity',
          type: 'pie',
          radius: isSemi ? ['48%', '74%'] : ['42%', '68%'],
          center: ['50%', isSemi ? '58%' : '48%'],
          startAngle: isSemi ? 180 : 90,
          endAngle: isSemi ? 360 : undefined,
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: !isSemi, position: 'outside', fontSize: 11 },
          labelLine: { show: !isSemi },
          data: [
            { value: counts.critical, name: 'Critical', itemStyle: { color: '#ef4444' } },
            { value: counts.warning, name: 'Warning', itemStyle: { color: '#f59e0b' } },
            { value: counts.cleared, name: 'Cleared', itemStyle: { color: '#22c55e' } },
          ],
        },
      ],
    }),
    [counts, clearedPct, isSemi, total]
  );

  return (
    <section className="dash-panel dash-panel--chart-center">
      <header className="dash-panel__head">
        <h3 className="dash-panel__title">Alarm Severity</h3>
        <button
          type="button"
          className="dash-panel__icon-btn"
          onClick={() => setOpen(true)}
          title="Fullscreen"
          aria-label="Fullscreen alarm severity"
          disabled={loading || !!error || !total}
        >
          <Maximize2 size={15} />
        </button>
      </header>

      <div className="dash-panel__body">
        {loading ? <div className="dash-panel__empty">Loading severity…</div> : null}
        {error ? <div className="dash-panel__error">{error}</div> : null}
        {!loading && !error && !total ? <div className="dash-panel__empty">No alarm data</div> : null}
        {!loading && !error && total ? (
          <ReactECharts option={option} style={{ height: 240, width: '100%' }} opts={{ renderer: 'svg' }} />
        ) : null}
      </div>

      {open && total ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="Alarm severity fullscreen">
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card">
            <header className="dash-panel__head">
              <h3 className="dash-panel__title">Alarm Severity</h3>
              <button type="button" className="dash-panel__icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </header>
            <ReactECharts option={option} style={{ height: 420, width: '100%' }} opts={{ renderer: 'svg' }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
