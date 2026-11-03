import React, { useEffect, useMemo, useState } from 'react';
import { fetchDeviceTraffic } from '../../../../api/performance';
import { formatBytesLabel, formatCount, formatPacketRate, formatRateLabel, packetAxisScale, rateAxisScale } from '../utils/format';
import {
  axisTimeLabel,
  formatPointTime,
  hexToRgba,
  useTimeRange,
} from '../utils/chartTime';
import ChartExportCard, { PerfStat as Stat } from './ChartExportCard';
import TimeRangeToolbar from './TimeRangeToolbar';

function peakValue(series) {
  const values = (series || [])
    .map((point) => (Array.isArray(point) ? Number(point[1]) : NaN))
    .filter((n) => Number.isFinite(n));
  return values.length ? Math.max(...values) : 0;
}

function lineSeries(name, data, color) {
  return {
    name,
    type: 'line',
    data: data || [],
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
          { offset: 0, color: hexToRgba(color, 0.22) },
          { offset: 1, color: hexToRgba(color, 0.02) },
        ],
      },
    },
    emphasis: { focus: 'series', itemStyle: { borderWidth: 2 } },
  };
}

function lineOption(lines, fromMs, toMs, formatValue = formatRateLabel, axisScale = rateAxisScale) {
  const peak = Math.max(0, ...lines.map((line) => peakValue(line.data)));
  const yMax = peak > 0 ? peak * 1.15 : 1;
  const scale = axisScale(peak);
  const xMin = Number.isFinite(Number(fromMs)) ? Number(fromMs) : undefined;
  const xMax = Number.isFinite(Number(toMs)) ? Number(toMs) : undefined;

  return {
    legend: {
      top: 0,
      right: 8,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: 'var(--muted, #64748b)', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', snap: true },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        if (!rows.length) return '';
        const ts = rows[0]?.value?.[0];
        const linesHtml = rows.map((p) => {
          const point = p?.value;
          const value = Array.isArray(point) ? formatValue(point[1]) : 'N/A';
          return `<b>${p.seriesName}</b>: ${value}`;
        });
        return `${formatPointTime(ts)}<br/>${linesHtml.join('<br/>')}`;
      },
    },
    grid: { top: 36, right: 12, bottom: 28, left: 12, containLabel: true },
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
        formatter: (value) => `${(Number(value) / scale.div).toFixed(2)} ${scale.suffix}`,
      },
      splitLine: { show: false },
    },
    series: lines.map((line) => lineSeries(line.name, line.data, line.color)),
  };
}

function PlaneCol({
  title,
  hint,
  rxPrefix,
  txPrefix,
  rx,
  tx,
  rxTotal,
  txTotal,
  rxStats,
  txStats,
  rxColor,
  txColor,
  fromMs,
  toMs,
  hostname,
  loading,
  totalFormat,
  rateFormat = formatRateLabel,
  axisScale = rateAxisScale,
  exportNote,
}) {
  const seriesList = useMemo(
    () => [
      { name: 'Incoming (RX)', data: rx || [], color: rxColor },
      { name: 'Outgoing (TX)', data: tx || [], color: txColor },
    ],
    [rx, tx, rxColor, txColor]
  );
  const option = useMemo(
    () => lineOption(seriesList, fromMs, toMs, rateFormat, axisScale),
    [seriesList, fromMs, toMs, rateFormat, axisScale]
  );

  return (
    <div className="lp-health__col">
      <p className="lp-health__col-hint">{hint}</p>
      <div className="lp-health__stat-row-grid">
        <Stat label={`${rxPrefix} total`} value={totalFormat(rxTotal)} />
        <Stat label={`${rxPrefix} avg`} value={rateFormat(rxStats?.avg)} />
        <Stat label={`${rxPrefix} min`} value={rateFormat(rxStats?.min)} />
        <Stat label={`${rxPrefix} max`} value={rateFormat(rxStats?.max)} />
      </div>
      <div className="lp-health__stat-row-grid">
        <Stat label={`${txPrefix} total`} value={totalFormat(txTotal)} />
        <Stat label={`${txPrefix} avg`} value={rateFormat(txStats?.avg)} />
        <Stat label={`${txPrefix} min`} value={rateFormat(txStats?.min)} />
        <Stat label={`${txPrefix} max`} value={rateFormat(txStats?.max)} />
      </div>
      <ChartExportCard
        title={title}
        option={option}
        loading={loading}
        exportOpts={{
          hostname,
          metric: title,
          seriesList,
          series: seriesList?.[0]?.data,
          fromMs,
          toMs,
          filePrefix: 'device-traffic',
          formatValue: rateFormat,
          note: exportNote,
        }}
      />
    </div>
  );
}

export default function DevicePerformanceTraffic({ deviceId, refreshKey }) {
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
        const next = await fetchDeviceTraffic(deviceId, range);
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load device traffic');
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
            <strong>Incoming (RX)</strong> is traffic the device receives.
            <strong> Outgoing (TX)</strong> is traffic the device sends.
            Totals are the exact sum for the selected range.
            Charts are <strong>1-minute</strong> rates from those sums.
            {points > 0 ? (
              <>
                {' '}
                <strong>{points}</strong> sample{points === 1 ? '' : 's'}
                {lastSampleAt ? <> · Last sample {lastSampleAt}</> : null}.
              </>
            ) : null}
          </>
        )}
        extra={(
          <div className="lp-traffic__glossary" aria-label="Traffic terms">
            <span><strong>Data plane</strong> — byte totals for the selected range, all interfaces</span>
            <span><strong>Management plane</strong> — packet totals for the selected range, all interfaces</span>
          </div>
        )}
        rangeAriaLabel="Traffic time range"
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
      {loading && !data ? <div className="dl-empty">Loading device traffic…</div> : null}

      {data ? (
        points === 0 ? (
          <div className="dl-empty">
            No traffic samples in the last {presetLabel.toLowerCase()}
          </div>
        ) : (
          <div className={`lp-health__charts${loading ? ' is-loading' : ''}`}>
            <PlaneCol
              title="Data plane"
              hint="Byte totals and 1-minute rates for this time range, across every interface."
              rxPrefix="Data in"
              txPrefix="Data out"
              rx={data.dataPlane?.rx}
              tx={data.dataPlane?.tx}
              rxTotal={data.summary?.totals?.download}
              txTotal={data.summary?.totals?.upload}
              rxStats={data.summary?.dataPlane?.rx}
              txStats={data.summary?.dataPlane?.tx}
              rxColor="#2563eb"
              txColor="#7c3aed"
              fromMs={fromMs}
              toMs={toMs}
              hostname={hostname}
              loading={loading}
              totalFormat={formatBytesLabel}
              rateFormat={formatRateLabel}
              axisScale={rateAxisScale}
              exportNote="1-minute rates from summed bytes in the selected range"
            />
            <PlaneCol
              title="Management plane"
              hint="Packet totals and 1-minute rates for this time range, across every interface."
              rxPrefix="Packets in"
              txPrefix="Packets out"
              rx={data.managementPlane?.rx}
              tx={data.managementPlane?.tx}
              rxTotal={data.summary?.totals?.packetsRx}
              txTotal={data.summary?.totals?.packetsTx}
              rxStats={data.summary?.managementPlane?.rx}
              txStats={data.summary?.managementPlane?.tx}
              rxColor="#0d9488"
              txColor="#f97316"
              fromMs={fromMs}
              toMs={toMs}
              hostname={hostname}
              loading={loading}
              totalFormat={formatCount}
              rateFormat={formatPacketRate}
              axisScale={packetAxisScale}
              exportNote="1-minute rates from summed packets in the selected range"
            />
          </div>
        )
      ) : null}
    </div>
  );
}
