import React, { useEffect, useMemo, useState } from 'react';
import { fetchDeviceHealth } from '../../../../api/performance';
import { formatPercentLabel } from '../utils/format';
import {
  axisTimeLabel,
  formatPointTime,
  hexToRgba,
  useTimeRange,
} from '../utils/chartTime';
import ChartExportCard, { PerfStat as Stat } from './ChartExportCard';
import TimeRangeToolbar from './TimeRangeToolbar';

function yAxisMax(series) {
  const values = (series || [])
    .map((point) => (Array.isArray(point) ? Number(point[1]) : NaN))
    .filter((n) => Number.isFinite(n));
  const peak = values.length ? Math.max(...values) : 1;
  if (peak <= 1) return 1;
  if (peak <= 5) return Number((peak * 1.25).toFixed(2));
  if (peak <= 20) return Number((peak * 1.2).toFixed(2));
  return Math.min(100, Math.ceil(peak * 1.15));
}

function lineOption(title, series, color, fromMs, toMs) {
  const yMax = yAxisMax(series);
  const xMin = Number.isFinite(Number(fromMs)) ? Number(fromMs) : undefined;
  const xMax = Number.isFinite(Number(toMs)) ? Number(toMs) : undefined;

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', snap: true },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const point = p?.value;
        if (!Array.isArray(point) || point.length < 2) return '';
        const value =
          point[1] == null || !Number.isFinite(Number(point[1]))
            ? 'N/A'
            : `${Number(point[1]).toFixed(2)}%`;
        return `${formatPointTime(point[0])}<br/><b>${p.seriesName}</b>: ${value}`;
      },
    },
    grid: { top: 24, right: 12, bottom: 28, left: 12, containLabel: true },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      boundaryGap: false,
      minInterval: 60 * 1000,
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
        formatter: (value) => `${Number(value).toFixed(2)}%`,
      },
      splitLine: { show: false },
    },
    series: [
      {
        name: title,
        type: 'line',
        data: series,
        smooth: 0.2,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 7,
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
        emphasis: { focus: 'series', itemStyle: { borderWidth: 2 } },
      },
    ],
  };
}

function lastNumeric(series) {
  const rows = Array.isArray(series) ? series : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = Number(rows[i]?.[1]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export default function DevicePerformanceHealth({ deviceId, refreshKey }) {
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceHealth(deviceId, range);
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load device health');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceId, refreshKey, range]);

  const fromMs = (data?.range?.from || range?.from) * 1000;
  const toMs = (data?.range?.to || range?.to) * 1000;

  const cpuOption = useMemo(
    () => lineOption('CPU', data?.historical?.cpu || [], '#2563eb', fromMs, toMs),
    [data, fromMs, toMs]
  );
  const memoryOption = useMemo(
    () => lineOption('Memory', data?.historical?.memory || [], '#f97316', fromMs, toMs),
    [data, fromMs, toMs]
  );

  const points = Number(data?.summary?.points) || 0;
  const lastSampleAt = data?.summary?.lastSampleAt
    ? new Date(data.summary.lastSampleAt).toLocaleString()
    : null;
  const hostname = data?.hostname || deviceId;

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Charts use <strong>1-minute</strong> CPU and memory averages from telemetry.
            {points > 0 ? (
              <>
                {' '}
                <strong>{points}</strong> sample{points === 1 ? '' : 's'}
                {lastSampleAt ? <> · Last sample {lastSampleAt}</> : null}.
              </>
            ) : null}
          </>
        )}
        rangeAriaLabel="Health time range"
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
      {loading && !data ? <div className="dl-empty">Loading device health…</div> : null}

      {data ? (
        points === 0 ? (
          <div className="dl-empty">
            No CPU or memory samples in the last {presetLabel.toLowerCase()}
          </div>
        ) : (
          <div className={`lp-health__charts${loading ? ' is-loading' : ''}`}>
            <div className="lp-health__col">
              <div className="lp-health__stat-row-grid">
                <Stat label="CPU latest" value={formatPercentLabel(lastNumeric(data.historical?.cpu))} />
                <Stat label="CPU min" value={formatPercentLabel(data.summary?.cpuMin)} />
                <Stat label="CPU avg" value={formatPercentLabel(data.summary?.cpuAvg)} />
                <Stat label="CPU max" value={formatPercentLabel(data.summary?.cpuMax)} />
              </div>
              <ChartExportCard
                title="CPU"
                option={cpuOption}
                loading={loading}
                exportOpts={{ hostname, metric: 'CPU', series: data.historical?.cpu, fromMs, toMs }}
              />
            </div>
            <div className="lp-health__col">
              <div className="lp-health__stat-row-grid">
                <Stat label="Memory latest" value={formatPercentLabel(lastNumeric(data.historical?.memory))} />
                <Stat label="Memory min" value={formatPercentLabel(data.summary?.memoryMin)} />
                <Stat label="Memory avg" value={formatPercentLabel(data.summary?.memoryAvg)} />
                <Stat label="Memory max" value={formatPercentLabel(data.summary?.memoryMax)} />
              </div>
              <ChartExportCard
                title="Memory"
                option={memoryOption}
                loading={loading}
                exportOpts={{ hostname, metric: 'Memory', series: data.historical?.memory, fromMs, toMs }}
              />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
