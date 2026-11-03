import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { fetchDeviceLinkHealth } from '../../../../api/performance';
import { formatDb, formatDbm, formatDuration, formatMs, formatPercentLabel, probeStatusLabel } from '../utils/format';
import {
  axisTimeLabel,
  formatPointTime,
  hexToRgba,
  useTimeRange,
} from '../utils/chartTime';
import { downloadHealthExcel, downloadHealthPdf } from '../utils/healthExport';
import ChartExportCard, { PerfStat as Stat } from './ChartExportCard';
import TimeRangeToolbar from './TimeRangeToolbar';

const KIND_LABEL = {
  lte: 'LTE',
  wan: 'WAN',
  other: 'Other',
};

const KIND_GROUP = {
  lte: 'LTE probes',
  wan: 'WAN probes',
  other: 'Other probes',
};

function dash(value) {
  if (value == null || value === '') return '—';
  return value;
}

function hasSeries(series) {
  return (series || []).some((point) => Number.isFinite(Number(point?.[1])));
}

function markOngoing(rows = [], toMs) {
  const next = rows.map((row) => ({ ...row, ongoing: false }));
  const last = next[next.length - 1];
  if (last && Number.isFinite(Number(toMs))) {
    last.to = Math.max(Number(last.to) || 0, Number(toMs));
    last.ongoing = Math.abs(Number(toMs) - Date.now()) < 3 * 60 * 1000;
  }
  return next;
}

function currentStatusSince(row, fromMs, toMs) {
  const status = row?.lastStatus;
  if (status !== 0 && status !== 1) {
    return { duration: '—', since: '', title: '' };
  }
  const intervals = row.intervals || [];
  const current = [...intervals].reverse().find((item) => item.status === status)
    || intervals[intervals.length - 1];
  const since = Number(current?.from);
  if (!Number.isFinite(since)) {
    return { duration: '—', since: '', title: '' };
  }
  const truncated = Number.isFinite(Number(fromMs)) && since <= Number(fromMs) + 60 * 1000;
  const endMs = Number.isFinite(Number(toMs)) ? Number(toMs) : Date.now();
  const duration = formatDuration(Math.max(0, (endMs - since) / 1000));
  const when = formatPointTime(since);
  const durationLabel = truncated ? `≥ ${duration}` : duration;
  const verb = status === 1 ? 'Reachable' : 'Unreachable';
  return {
    duration: durationLabel,
    since: when,
    title: truncated
      ? `${verb} for the whole selected range (at least ${duration}, since ${when})`
      : `${verb} for ${duration} since ${when}`,
  };
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

function lineOption(lines, fromMs, toMs, formatValue, yMaxCap = null, signed = false) {
  const visible = lines.filter((line) => hasSeries(line.data));
  if (!visible.length) return null;
  const values = visible.flatMap((line) => (line.data || [])
    .map((point) => Number(point?.[1]))
    .filter((n) => Number.isFinite(n)));
  const peak = values.length ? Math.max(...values) : 0;
  const floor = values.length ? Math.min(...values) : 0;
  let yMin = 0;
  let yMax = yMaxCap != null ? yMaxCap : (peak > 0 ? peak * 1.15 : 1);
  if (signed) {
    const pad = Math.max(2, (peak - floor) * 0.15 || 5);
    yMin = floor - pad;
    yMax = peak + pad;
  }
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
        const html = rows.map((p) => {
          const point = p?.value;
          const value = Array.isArray(point) ? formatValue(point[1]) : 'N/A';
          return `<b>${p.seriesName}</b>: ${value}`;
        });
        return `${formatPointTime(ts)}<br/>${html.join('<br/>')}`;
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
      min: yMin,
      max: yMax,
      axisLabel: {
        color: 'var(--muted, #64748b)',
        fontSize: 10,
        formatter: (value) => formatValue(value),
      },
      splitLine: { show: false },
    },
    series: visible.map((line) => lineSeries(line.name, line.data, line.color)),
  };
}

function PathPills({ items, selectedName, onSelect, label, countLabel }) {
  if (!items.length) return null;
  return (
    <div className="lp-iface-picker-wrap">
      <div className="lp-iface-picker__meta">
        <strong>{label}</strong>
        <span>{countLabel}</span>
      </div>
      <div className="lp-iface-picker" role="tablist" aria-label={label}>
        {items.map((row) => (
          <button
            key={row.name}
            type="button"
            role="tab"
            aria-selected={row.name === selectedName}
            className={`lp-iface-pick${row.name === selectedName ? ' is-active' : ''}`}
            onClick={() => onSelect(row.name)}
          >
            {row.lastStatus === 0 || row.lastStatus === 1 ? (
              <span
                className={`lp-iface-pick__dot${row.lastStatus === 1 ? ' is-up' : ' is-down'}`}
                aria-hidden
              />
            ) : null}
            {row.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DevicePerformanceLinkHealth({ deviceId, refreshKey }) {
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
  } = useTimeRange('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedRadio, setSelectedRadio] = useState('');
  const [intervalQuery, setIntervalQuery] = useState('');

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceLinkHealth(deviceId, range);
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load link health');
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
  const paths = data?.paths || [];
  const radios = data?.radios || [];

  useEffect(() => {
    if (!paths.length) return;
    if (paths.some((row) => row.name === selectedName)) return;
    const preferred = paths.find((row) => row.lastStatus === 1) || paths[0];
    setSelectedName(preferred.name);
  }, [paths, selectedName]);

  useEffect(() => {
    if (!radios.length) return;
    if (radios.some((row) => row.name === selectedRadio)) return;
    setSelectedRadio(radios[0].name);
  }, [radios, selectedRadio]);

  const selected = paths.find((row) => row.name === selectedName) || null;
  const radio = radios.find((row) => row.name === selectedRadio) || null;
  const selectedSince = currentStatusSince(selected, fromMs, toMs);
  const intervals = useMemo(
    () => (selected ? markOngoing(selected.intervals || [], toMs) : []),
    [selected, toMs]
  );
  const intervalNeedle = intervalQuery.trim().toLowerCase();
  const visibleIntervals = intervalNeedle
    ? intervals.filter((row) => {
      const from = formatPointTime(row.from).toLowerCase();
      const to = (row.ongoing ? 'till now' : formatPointTime(row.to)).toLowerCase();
      const status = probeStatusLabel(row.status).toLowerCase();
      return from.includes(intervalNeedle) || to.includes(intervalNeedle) || status.includes(intervalNeedle);
    })
    : intervals;

  const hostname = data?.hostname || deviceId;
  const exportBase = {
    hostname,
    fromMs,
    toMs,
    filePrefix: 'device-link-health',
  };

  const latencyOption = useMemo(
    () => lineOption(
      [{ name: 'Latency', data: selected?.latency?.series || [], color: '#2563eb' }],
      fromMs,
      toMs,
      formatMs
    ),
    [selected, fromMs, toMs]
  );
  const jitterOption = useMemo(
    () => lineOption(
      [{ name: 'Jitter', data: selected?.jitter?.series || [], color: '#7c3aed' }],
      fromMs,
      toMs,
      formatMs
    ),
    [selected, fromMs, toMs]
  );
  const lossOption = useMemo(
    () => lineOption(
      [{ name: 'Packet loss', data: selected?.loss?.series || [], color: '#f97316' }],
      fromMs,
      toMs,
      formatPercentLabel,
      100
    ),
    [selected, fromMs, toMs]
  );

  const qualityOption = useMemo(
    () => lineOption(
      [
        { name: 'SINR', data: radio?.sinr?.series || [], color: '#ea580c' },
        { name: 'RSRQ', data: radio?.rsrq?.series || [], color: '#0891b2' },
      ],
      fromMs,
      toMs,
      formatDb,
      null,
      true
    ),
    [radio, fromMs, toMs]
  );
  const signalOption = useMemo(
    () => lineOption(
      [
        { name: 'Signal', data: radio?.signal?.series || [], color: '#0d9488' },
        { name: 'RSSI', data: radio?.rssi?.series || [], color: '#2563eb' },
        { name: 'RSRP', data: radio?.rsrp?.series || [], color: '#7c3aed' },
      ],
      fromMs,
      toMs,
      formatDbm,
      null,
      true
    ),
    [radio, fromMs, toMs]
  );

  const grouped = {
    lte: paths.filter((row) => row.kind === 'lte'),
    wan: paths.filter((row) => row.kind === 'wan'),
    other: paths.filter((row) => row.kind === 'other'),
  };
  const upNow = data?.summary?.upNow ?? paths.filter((row) => row.lastStatus === 1).length;
  const downNow = data?.summary?.downNow ?? paths.filter((row) => row.lastStatus === 0).length;

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Probe reachability to each path target (for example 8.8.8.8), plus latency,
            jitter, and packet loss from those health checks. This is separate from
            Interface Health, which shows the physical carrier / link up state on each
            port. A WAN can show carrier up while the probe is unreachable if routing
            or the target is down. Operator, SIM, and signal come from LTE radio history.
            History can lag — try 7 days if 1 hour is empty.
          </>
        )}
        rangeAriaLabel="Link health time range"
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
      {loading && !data ? <div className="dl-empty">Loading link health…</div> : null}

      {data ? (
        data.hasData || data.summary?.lastSampleAt || data.summary?.lastRadioAt ? (
          <>
            {paths.length ? (
              <section className="lp-link-section">
            {['lte', 'wan', 'other'].map((kind) => (
              <PathPills
                key={kind}
                items={grouped[kind]}
                selectedName={selectedName}
                onSelect={(name) => {
                  setSelectedName(name);
                  setIntervalQuery('');
                }}
                label={KIND_GROUP[kind]}
                countLabel={
                  kind === 'lte' || kind === 'wan'
                    ? `${grouped[kind].length} · ${grouped[kind].filter((row) => row.lastStatus === 1).length} reachable · ${grouped[kind].filter((row) => row.lastStatus === 0).length} unreachable`
                    : `${grouped[kind].length}`
                }
              />
            ))}

            {selected ? (
              <>
                <div className="lp-iface-kpis">
                  <Stat label="Kind" value={KIND_LABEL[selected.kind] || 'Other'} />
                  <Stat label="Probe" value={dash(selected.probe)} />
                  <Stat label="Target" value={dash(selected.target)} />
                  <Stat
                    label="Probe status"
                    value={(
                      <span className={`lp-iface-pill${selected.lastStatus === 1 ? ' is-up' : selected.lastStatus === 0 ? ' is-down' : ''}`}>
                        {probeStatusLabel(selected.lastStatus)}
                      </span>
                    )}
                  />
                  <Stat
                    label={selected.lastStatus === 0 ? 'Unreachable for' : 'Reachable for'}
                    value={(
                      <span className="lp-iface-since" title={selectedSince.title}>
                        <span className="lp-copyable__text">{selectedSince.duration}</span>
                        <span className="lp-health__stat-sub">
                          {selectedSince.since ? `since ${selectedSince.since}` : '\u00a0'}
                        </span>
                      </span>
                    )}
                  />
                  <Stat label="Probe uptime in range" value={formatPercentLabel(selected.uptimePercentage)} />
                  <Stat label="Last seen" value={selected.lastSeen ? formatPointTime(selected.lastSeen) : '—'} />
                  <Stat label="Latency" value={formatMs(selected.latency?.last)} />
                  <Stat label="Latency avg" value={formatMs(selected.latency?.avg)} />
                  <Stat label="Latency max" value={formatMs(selected.latency?.max)} />
                  <Stat label="Jitter" value={formatMs(selected.jitter?.last)} />
                  <Stat label="Jitter avg" value={formatMs(selected.jitter?.avg)} />
                  <Stat label="Packet loss" value={formatPercentLabel(selected.loss?.last)} />
                  <Stat label="Loss avg" value={formatPercentLabel(selected.loss?.avg)} />
                </div>

                <div className={`lp-health__charts${loading ? ' is-loading' : ''}`}>
                  <ChartExportCard
                    title={`${selected.name} latency`}
                    option={latencyOption}
                    empty="No latency samples in this range"
                    loading={loading}
                    exportOpts={{
                      ...exportBase,
                      metric: `${selected.name} latency`,
                      formatValue: formatMs,
                      series: selected.latency?.series || [],
                    }}
                  />
                  <ChartExportCard
                    title={`${selected.name} jitter`}
                    option={jitterOption}
                    empty="No jitter samples in this range"
                    loading={loading}
                    exportOpts={{
                      ...exportBase,
                      metric: `${selected.name} jitter`,
                      formatValue: formatMs,
                      series: selected.jitter?.series || [],
                    }}
                  />
                  <ChartExportCard
                    title={`${selected.name} packet loss`}
                    option={lossOption}
                    empty="No packet-loss samples in this range"
                    loading={loading}
                    wide
                    exportOpts={{
                      ...exportBase,
                      metric: `${selected.name} packet loss`,
                      formatValue: formatPercentLabel,
                      series: selected.loss?.series || [],
                    }}
                  />
                </div>

                <article className="lp-sheet lp-iface-intervals">
                  <header className="lp-sheet__head lp-iface-intervals__head">
                    <span>{selected.name} probe reachable / unreachable</span>
                    <div className="lp-iface-intervals__tools">
                      <button
                        type="button"
                        className="dl-btn"
                        disabled={!intervals.length}
                        onClick={() => downloadHealthExcel({
                          ...exportBase,
                          metric: `${selected.name} probe-status`,
                          tableRows: intervals.map((row) => ({
                            From: formatPointTime(row.from),
                            To: row.ongoing ? 'Till now' : formatPointTime(row.to),
                            'Probe status': probeStatusLabel(row.status),
                          })),
                        })}
                      >
                        <FileSpreadsheet size={13} />
                        Excel
                      </button>
                      <button
                        type="button"
                        className="dl-btn"
                        disabled={!intervals.length}
                        onClick={() => downloadHealthPdf({
                          ...exportBase,
                          metric: `${selected.name} probe-status`,
                          tableRows: intervals.map((row) => ({
                            From: formatPointTime(row.from),
                            To: row.ongoing ? 'Till now' : formatPointTime(row.to),
                            'Probe status': probeStatusLabel(row.status),
                          })),
                          note: 'probe reachability intervals from twtrans samples in the selected range',
                        })}
                      >
                        <FileText size={13} />
                        PDF
                      </button>
                      <label className="lp-iface-search-label">
                        Search
                        <input
                          type="search"
                          className="lp-iface-search"
                          value={intervalQuery}
                          onChange={(e) => setIntervalQuery(e.target.value)}
                          placeholder="From, to, probe status"
                        />
                      </label>
                    </div>
                  </header>
                  <div className="dl-table-scroll lp-iface-intervals__scroll">
                    <table className="dl-table">
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>To</th>
                          <th>Probe status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleIntervals.length ? visibleIntervals.map((row) => (
                          <tr key={`${row.from}-${row.status}`}>
                            <td>{formatPointTime(row.from)}</td>
                            <td>{row.ongoing ? 'Till now' : formatPointTime(row.to)}</td>
                            <td>
                              <span className={`lp-iface-pill${row.status === 1 ? ' is-up' : ' is-down'}`}>
                                {probeStatusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={3} className="lp-na">No probe reachability intervals in this range</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <footer className="lp-iface-intervals__foot">
                    Showing {visibleIntervals.length} of {intervals.length} {intervals.length === 1 ? 'entry' : 'entries'}
                    {paths.length ? ` · ${paths.length} path${paths.length === 1 ? '' : 's'} · ${upNow} reachable · ${downNow} unreachable` : ''}
                  </footer>
                </article>
              </>
            ) : null}
              </section>
            ) : data.summary?.lastSampleAt ? (
              <div className="dl-empty">
                No probe samples in the last {presetLabel.toLowerCase()}.
                Last probe was {formatPointTime(data.summary.lastSampleAt)}. Try a wider range.
              </div>
            ) : null}

            {radios.length ? (
              <section className="lp-link-section">
                <PathPills
                  items={radios}
                  selectedName={selectedRadio}
                  onSelect={setSelectedRadio}
                  label="LTE radio"
                  countLabel={`${radios.length} radio${radios.length === 1 ? '' : 's'}`}
                />
                {radio ? (
                  <>
                    <div className="lp-iface-kpis">
                      <Stat label="Operator" value={dash(radio.operator)} />
                      <Stat label="SIM" value={dash(radio.sim)} />
                      <Stat label="LTE IP" value={dash(radio.ip)} />
                      <Stat label="Network" value={dash(radio.network)} />
                      <Stat label="Registration" value={dash(radio.registration)} />
                      <Stat label="Attach" value={dash(radio.attach)} />
                      <Stat label="IMEI" value={dash(radio.imei)} />
                      <Stat label="Band" value={dash(radio.band)} />
                      <Stat label="Last seen" value={radio.lastSeen ? formatPointTime(radio.lastSeen) : '—'} />
                      <Stat label="Signal" value={formatDbm(radio.signal?.last)} />
                      <Stat label="Signal avg" value={formatDbm(radio.signal?.avg)} />
                      <Stat label="RSSI" value={formatDbm(radio.rssi?.last)} />
                      <Stat label="RSRP" value={formatDbm(radio.rsrp?.last)} />
                      <Stat label="RSRQ" value={formatDb(radio.rsrq?.last)} />
                      <Stat label="SINR" value={formatDb(radio.sinr?.last)} />
                      <Stat label="SINR avg" value={formatDb(radio.sinr?.avg)} />
                    </div>
                    <div className={`lp-health__charts${loading ? ' is-loading' : ''}`}>
                      <ChartExportCard
                        title={`${radio.name} signal`}
                        option={signalOption}
                        empty="No signal samples in this range"
                        loading={loading}
                        exportOpts={{
                          ...exportBase,
                          metric: `${radio.name} signal`,
                          formatValue: formatDbm,
                          seriesList: [
                            { name: 'Signal', data: radio.signal?.series || [] },
                            { name: 'RSSI', data: radio.rssi?.series || [] },
                            { name: 'RSRP', data: radio.rsrp?.series || [] },
                          ],
                        }}
                      />
                      <ChartExportCard
                        title={`${radio.name} radio quality`}
                        option={qualityOption}
                        empty="No SINR / RSRQ samples in this range"
                        loading={loading}
                        exportOpts={{
                          ...exportBase,
                          metric: `${radio.name} radio quality`,
                          formatValue: formatDb,
                          seriesList: [
                            { name: 'SINR', data: radio.sinr?.series || [] },
                            { name: 'RSRQ', data: radio.rsrq?.series || [] },
                          ],
                        }}
                      />
                    </div>
                  </>
                ) : null}
              </section>
            ) : data.summary?.lastRadioAt ? (
              <div className="dl-empty">
                No LTE radio samples in the last {presetLabel.toLowerCase()}.
                Last radio sample was {formatPointTime(data.summary.lastRadioAt)}. Try a wider range.
              </div>
            ) : null}
          </>
        ) : (
          <div className="dl-empty">
            This device has no probe or LTE radio history in this range.
          </div>
        )
      ) : null}
    </div>
  );
}
