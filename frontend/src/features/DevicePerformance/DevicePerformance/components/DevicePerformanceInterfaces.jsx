import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileSpreadsheet, FileText } from 'lucide-react';
import { fetchDeviceInterfaceHealth } from '../../../../api/performance';
import {
  formatBytesLabel,
  formatCount,
  formatDuration,
  formatPacketRate,
  formatPercentLabel,
  formatRateLabel,
  carrierStatusLabel,
  isEmpty,
  packetAxisScale,
  rateAxisScale,
} from '../utils/format';
import {
  axisTimeLabel,
  formatPointTime,
  hexToRgba,
  useTimeRange,
} from '../utils/chartTime';
import { downloadHealthExcel, downloadHealthPdf } from '../utils/healthExport';
import ChartExportCard, { PerfStat as Stat } from './ChartExportCard';
import TimeRangeToolbar from './TimeRangeToolbar';

function dash(value) {
  if (value == null || value === '') return '—';
  return value;
}

function CopyBtn({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (isEmpty(value) || value === '—') return null;

  const onCopy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="dd-icon-btn"
      onClick={onCopy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Copyable({ value, label, compact = false }) {
  if (isEmpty(value) || value === '—') return '—';
  return (
    <span className="dd-inline">
      <span
        className={`lp-copyable__text${compact ? ' is-compact' : ''}`}
        title={String(value)}
      >
        {value}
      </span>
      <CopyBtn value={value} label={label} />
    </span>
  );
}

function currentStatusSince(row, fromMs, toMs) {
  const status = row?.lastStatus;
  if (status !== 0 && status !== 1) {
    return { label: '—', duration: '—', since: '', title: '' };
  }
  const intervals = row.intervals || [];
  const current = [...intervals].reverse().find((item) => item.status === status)
    || intervals[intervals.length - 1];
  let since = Number(current?.from);
  if (!Number.isFinite(since) && row.series?.length) {
    for (let i = row.series.length - 1; i >= 0; i -= 1) {
      if (Number(row.series[i]?.[1]) !== status) break;
      const ts = Number(row.series[i]?.[0]);
      if (Number.isFinite(ts)) since = ts;
    }
  }
  if (!Number.isFinite(since)) {
    return { label: '—', duration: '—', since: '', title: '' };
  }
  const truncated = Number.isFinite(Number(fromMs)) && since <= Number(fromMs) + 60 * 1000;
  const endMs = Number.isFinite(Number(toMs)) ? Number(toMs) : Date.now();
  const duration = formatDuration(Math.max(0, (endMs - since) / 1000));
  const when = formatPointTime(since);
  const durationLabel = truncated ? `≥ ${duration}` : duration;
  const verb = status === 1 ? 'Link up' : 'Link down';
  return {
    label: durationLabel,
    duration: durationLabel,
    since: when,
    title: truncated
      ? `${verb} for the whole selected range (at least ${duration}, since ${when})`
      : `${verb} for ${duration} since ${when}`,
  };
}

function seriesAvgMax(series) {
  const values = (series || [])
    .map((point) => Number(point?.[1]))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return { avg: 0, max: 0 };
  const sum = values.reduce((acc, n) => acc + n, 0);
  return {
    avg: sum / values.length,
    max: Math.max(...values),
  };
}

function intervalsFromSeries(series = [], toMs) {
  const rows = [];
  for (const point of series) {
    const ts = Number(point?.[0]);
    const status = Number(point?.[1]);
    if (!Number.isFinite(ts) || (status !== 0 && status !== 1)) continue;
    const last = rows[rows.length - 1];
    if (last && last.status === status) {
      last.to = ts;
    } else {
      if (last) last.to = ts;
      rows.push({ from: ts, to: ts, status, ongoing: false });
    }
  }
  return markOngoing(rows, toMs);
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

function ifaceIntervals(row, toMs) {
  if (row?.intervals?.length) {
    return markOngoing(row.intervals, toMs);
  }
  return intervalsFromSeries(row?.series, toMs);
}

function assignmentText(row) {
  return [row?.slot, row?.label].filter(Boolean).join(' · ');
}

function ifaceHeading(row) {
  const assigned = assignmentText(row);
  return assigned ? `${row.name} · ${assigned}` : row.name;
}

function ifaceRank(name) {
  const n = String(name || '').toLowerCase();
  if (n.startsWith('br-lan')) return 0;
  if (n === 'lan' || n.startsWith('lan')) return 1;
  if (n.startsWith('eth')) return 2;
  if (n.startsWith('vti')) return 3;
  if (n.startsWith('wan') || n.startsWith('sfp')) return 4;
  return 5;
}

function sortIfaces(interfaces = []) {
  return [...interfaces].sort((a, b) => {
    const assignedA = a.slot || a.label ? 0 : 1;
    const assignedB = b.slot || b.label ? 0 : 1;
    if (assignedA !== assignedB) return assignedA - assignedB;
    const rank = ifaceRank(a.name) - ifaceRank(b.name);
    if (rank) return rank;
    return String(a.name).localeCompare(String(b.name));
  });
}

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

function dualLineOption(lines, fromMs, toMs, formatValue, axisScale) {
  const peak = Math.max(0, ...lines.map((line) => peakValue(line.data)));
  if (!peak && !lines.some((line) => (line.data || []).length)) return null;
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

export default function DevicePerformanceInterfaces({ deviceId, refreshKey }) {
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
  const [selectedName, setSelectedName] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [intervalQuery, setIntervalQuery] = useState('');

  useEffect(() => {
    if (!deviceId || !range?.from || !range?.to) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchDeviceInterfaceHealth(deviceId, range);
        if (alive) setData(next);
      } catch (err) {
        if (alive) {
          setData(null);
          setError(err.message || 'Failed to load interface health');
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
  const interfaces = useMemo(
    () => sortIfaces((data?.interfaces || []).filter((row) => row.lastStatus === 0 || row.lastStatus === 1)),
    [data]
  );

  useEffect(() => {
    if (!interfaces.length) return;
    if (interfaces.some((row) => row.name === selectedName)) return;
    const preferred = interfaces.find((row) => row.lastStatus === 1) || interfaces[0];
    setSelectedName(preferred.name);
  }, [interfaces, selectedName]);

  const selected = interfaces.find((row) => row.name === selectedName) || null;
  const selectedSince = currentStatusSince(selected, fromMs, toMs);
  const intervals = useMemo(
    () => (selected ? ifaceIntervals(selected, toMs) : []),
    [selected, toMs]
  );
  const intervalNeedle = intervalQuery.trim().toLowerCase();
  const visibleIntervals = intervalNeedle
    ? intervals.filter((row) => {
      const from = formatPointTime(row.from).toLowerCase();
      const to = (row.ongoing ? 'till now' : formatPointTime(row.to)).toLowerCase();
      const status = carrierStatusLabel(row.status).toLowerCase();
      return from.includes(intervalNeedle) || to.includes(intervalNeedle) || status.includes(intervalNeedle);
    })
    : intervals;
  const intervalExportRows = intervals.map((row) => ({
    From: formatPointTime(row.from),
    To: row.ongoing ? 'Till now' : formatPointTime(row.to),
    Carrier: carrierStatusLabel(row.status),
  }));
  const downloadStats = seriesAvgMax(selected?.traffic?.download);
  const uploadStats = seriesAvgMax(selected?.traffic?.upload);
  const packetRxStats = seriesAvgMax(selected?.traffic?.packetsRx);
  const packetTxStats = seriesAvgMax(selected?.traffic?.packetsTx);
  const visibleInterfaces = interfaces.filter((row) => {
    if (tableFilter === 'up') return row.lastStatus === 1;
    if (tableFilter === 'down') return row.lastStatus === 0;
    return true;
  });
  const throughputOption = useMemo(
    () => dualLineOption(
      [
        { name: 'Download', data: selected?.traffic?.download || [], color: '#0d9488' },
        { name: 'Upload', data: selected?.traffic?.upload || [], color: '#2563eb' },
      ],
      fromMs,
      toMs,
      formatRateLabel,
      rateAxisScale
    ),
    [selected, fromMs, toMs]
  );
  const packetOption = useMemo(
    () => dualLineOption(
      [
        { name: 'Received', data: selected?.traffic?.packetsRx || [], color: '#7c3aed' },
        { name: 'Sent', data: selected?.traffic?.packetsTx || [], color: '#f97316' },
      ],
      fromMs,
      toMs,
      formatPacketRate,
      packetAxisScale
    ),
    [selected, fromMs, toMs]
  );

  const hostname = data?.hostname || deviceId;
  const exportBase = {
    hostname,
    fromMs,
    toMs,
    filePrefix: 'device-interfaces',
  };
  const tableRows = visibleInterfaces.map((row) => ({
    Interface: row.name,
    Slot: row.slot || '—',
    Operator: row.op || '—',
    'Service ID': row.con_id || '—',
    Carrier: carrierStatusLabel(row.lastStatus),
    IP: row.ip || '—',
    IPv6: row.ipv6 || '—',
    MAC: row.mac || '—',
    'Carrier uptime in range': formatPercentLabel(row.uptimePercentage),
    'Current stretch': currentStatusSince(row, fromMs, toMs).title,
    Download: formatBytesLabel(row.totals?.download),
    Upload: formatBytesLabel(row.totals?.upload),
    'Packets RX': formatCount(row.totals?.packetsRx),
    'Packets TX': formatCount(row.totals?.packetsTx),
    Samples: formatCount(row.samples),
    'Last seen': row.last?.lastSeen ? formatPointTime(row.last.lastSeen * 1000) : '—',
  }));
  const upNow = data?.summary?.upNow ?? interfaces.filter((row) => row.lastStatus === 1).length;
  const downNow = data?.summary?.downNow ?? interfaces.filter((row) => row.lastStatus === 0).length;

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Physical carrier / link status on each interface from nettrans samples,
            plus traffic totals and per-minute rates. This is separate from Link Health,
            which shows probe reachability to configured targets (for example 8.8.8.8).
            A port can show carrier up while the WAN probe is unreachable.
            Assigned LAN/WAN/SIM slots and operator labels from Onboard Config appear next to the CPE name.
            IP, IPv6, and MAC come from the live interface snapshot.
          </>
        )}
        rangeAriaLabel="Interface health time range"
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
      {loading && !data ? <div className="dl-empty">Loading interface health…</div> : null}

      {data ? (
        data.hasData ? (
          <>
            <div className="lp-iface-picker-wrap">
              <div className="lp-iface-picker__meta">
                <strong>Interfaces</strong>
                <span>{interfaces.length} · {upNow} link up · {downNow} link down</span>
              </div>
              <div className="lp-iface-picker" role="tablist" aria-label="Device interfaces">
                {interfaces.map((row) => (
                  <button
                    key={row.name}
                    type="button"
                    role="tab"
                    aria-selected={row.name === selectedName}
                    className={`lp-iface-pick${row.name === selectedName ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedName(row.name);
                      setIntervalQuery('');
                    }}
                  >
                    <span
                      className={`lp-iface-pick__dot${row.lastStatus === 1 ? ' is-up' : row.lastStatus === 0 ? ' is-down' : ''}`}
                      aria-hidden
                    />
                    <span className="lp-iface-pick__text">
                      <span>{row.name}</span>
                      {assignmentText(row) ? (
                        <span className="lp-iface-pick__assign">{assignmentText(row)}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selected ? (
              <>
                <div className="lp-iface-kpis">
                  <Stat label="Interface" value={selected.name} />
                  {selected.slot ? <Stat label="Slot" value={selected.slot} /> : null}
                  {selected.op ? <Stat label="Operator" value={selected.op} /> : null}
                  {selected.con_id ? <Stat label="Service ID" value={selected.con_id} /> : null}
                  <Stat
                    label="IP"
                    value={<Copyable value={selected.ip} label="IP" />}
                  />
                  <Stat
                    label="MAC"
                    value={<Copyable value={selected.mac} label="MAC" />}
                  />
                  <Stat
                    label="IPv6"
                    value={<Copyable value={selected.ipv6} label="IPv6" compact />}
                  />
                  <Stat
                    label="Carrier"
                    value={(
                      <span className={`lp-iface-pill${selected.lastStatus === 1 ? ' is-up' : selected.lastStatus === 0 ? ' is-down' : ''}`}>
                        {carrierStatusLabel(selected.lastStatus)}
                      </span>
                    )}
                  />
                  <Stat
                    label={selected.lastStatus === 0 ? 'Link down for' : 'Link up for'}
                    value={(
                      <span className="lp-iface-since" title={selectedSince.title}>
                        <span className="lp-copyable__text">{selectedSince.duration}</span>
                        <span className="lp-health__stat-sub">
                          {selectedSince.since ? `since ${selectedSince.since}` : '\u00a0'}
                        </span>
                      </span>
                    )}
                  />
                  <Stat label="Download" value={formatBytesLabel(selected.totals?.download)} />
                  <Stat label="Download avg" value={formatRateLabel(downloadStats.avg)} />
                  <Stat label="Download max" value={formatRateLabel(downloadStats.max)} />
                  <Stat label="Upload" value={formatBytesLabel(selected.totals?.upload)} />
                  <Stat label="Upload avg" value={formatRateLabel(uploadStats.avg)} />
                  <Stat label="Upload max" value={formatRateLabel(uploadStats.max)} />
                  <Stat label="Packets sent" value={formatCount(selected.totals?.packetsTx)} />
                  <Stat label="Packets received" value={formatCount(selected.totals?.packetsRx)} />
                  <Stat label="Packets avg" value={formatPacketRate((packetRxStats.avg + packetTxStats.avg) / 2)} />
                  <Stat label="Packets max" value={formatPacketRate(Math.max(packetRxStats.max, packetTxStats.max))} />
                </div>

                <div className={`lp-health__charts${loading ? ' is-loading' : ''}`}>
                  <ChartExportCard
                    title={`${ifaceHeading(selected)} throughput`}
                    option={throughputOption}
                    empty="No throughput in this range"
                    loading={loading}
                    exportOpts={{
                      ...exportBase,
                      metric: `${ifaceHeading(selected)} throughput`,
                      note: 'download/upload rates for this interface',
                      formatValue: formatRateLabel,
                      seriesList: [
                        { name: 'Download', data: selected.traffic?.download || [] },
                        { name: 'Upload', data: selected.traffic?.upload || [] },
                      ],
                    }}
                  />
                  <ChartExportCard
                    title={`${ifaceHeading(selected)} packets`}
                    option={packetOption}
                    empty="No packet samples in this range"
                    loading={loading}
                    exportOpts={{
                      ...exportBase,
                      metric: `${ifaceHeading(selected)} packets`,
                      note: 'packet rates for this interface',
                      formatValue: formatPacketRate,
                      seriesList: [
                        { name: 'Received', data: selected.traffic?.packetsRx || [] },
                        { name: 'Sent', data: selected.traffic?.packetsTx || [] },
                      ],
                    }}
                  />
                </div>

                <article className="lp-sheet lp-iface-intervals">
                  <header className="lp-sheet__head lp-iface-intervals__head">
                    <span>{ifaceHeading(selected)} carrier up / down</span>
                    <div className="lp-iface-intervals__tools">
                      <button
                        type="button"
                        className="dl-btn"
                        disabled={!intervals.length}
                        onClick={() => downloadHealthExcel({
                          ...exportBase,
                          metric: `${ifaceHeading(selected)} carrier`,
                          tableRows: intervalExportRows,
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
                          metric: `${ifaceHeading(selected)} carrier`,
                          tableRows: intervalExportRows,
                          note: 'carrier up/down intervals from nettrans samples in the selected range',
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
                          placeholder="From, to, carrier"
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
                          <th>Carrier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleIntervals.length ? visibleIntervals.map((row) => (
                          <tr key={`${row.from}-${row.status}`}>
                            <td>{formatPointTime(row.from)}</td>
                            <td>{row.ongoing ? 'Till now' : formatPointTime(row.to)}</td>
                            <td>
                              <span className={`lp-iface-pill${row.status === 1 ? ' is-up' : ' is-down'}`}>
                                {carrierStatusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={3} className="lp-na">No carrier up/down intervals in this range</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <footer className="lp-iface-intervals__foot">
                    Showing {visibleIntervals.length} of {intervals.length} {intervals.length === 1 ? 'entry' : 'entries'}
                  </footer>
                </article>
              </>
            ) : null}

            <article className={`lp-sheet lp-iface-table${loading ? ' is-loading' : ''}`}>
              <header className="lp-sheet__head lp-iface-intervals__head">
                <span>All interfaces</span>
                <div className="lp-iface-intervals__tools">
                  <div className="lp-health__presets" role="group" aria-label="Filter interfaces">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'up', label: 'Link up' },
                      { id: 'down', label: 'Link down' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`lp-health__preset${tableFilter === item.id ? ' is-active' : ''}`}
                        onClick={() => setTableFilter(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="dl-btn"
                    disabled={!tableRows.length}
                    onClick={() => downloadHealthExcel({
                      ...exportBase,
                      metric: 'All interfaces',
                      tableRows,
                    })}
                  >
                    <FileSpreadsheet size={13} />
                    Excel
                  </button>
                  <button
                    type="button"
                    className="dl-btn"
                    disabled={!tableRows.length}
                    onClick={() => downloadHealthPdf({
                      ...exportBase,
                      metric: 'All interfaces',
                      tableRows,
                      note: 'per-interface details in the selected range',
                    })}
                  >
                    <FileText size={13} />
                    PDF
                  </button>
                </div>
              </header>
              <div className="dl-table-scroll lp-iface-table__scroll">
                <table className="dl-table">
                  <thead>
                    <tr>
                      <th>Interface</th>
                      <th>Slot</th>
                      <th>Operator</th>
                      <th>Service ID</th>
                      <th>Carrier</th>
                      <th>IP</th>
                      <th>IPv6</th>
                      <th>MAC</th>
                      <th>Carrier uptime</th>
                      <th>Current stretch</th>
                      <th>Download</th>
                      <th>Upload</th>
                      <th>Packets RX</th>
                      <th>Packets TX</th>
                      <th>Samples</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInterfaces.length ? visibleInterfaces.map((row) => (
                      <tr
                        key={row.name}
                        className={row.name === selectedName ? 'is-selected' : ''}
                        onClick={() => {
                          setSelectedName(row.name);
                          setIntervalQuery('');
                        }}
                      >
                        <td className="dl-table__strong">{row.name}</td>
                        <td>{dash(row.slot)}</td>
                        <td>{dash(row.op)}</td>
                        <td>{dash(row.con_id)}</td>
                        <td>
                          <span className={`lp-iface-pill${row.lastStatus === 1 ? ' is-up' : row.lastStatus === 0 ? ' is-down' : ''}`}>
                            {carrierStatusLabel(row.lastStatus)}
                          </span>
                        </td>
                        <td>{dash(row.ip)}</td>
                        <td>{dash(row.ipv6)}</td>
                        <td>{dash(row.mac)}</td>
                        <td>{formatPercentLabel(row.uptimePercentage)}</td>
                        <td title={currentStatusSince(row, fromMs, toMs).title}>
                          {currentStatusSince(row, fromMs, toMs).duration}
                        </td>
                        <td>{formatBytesLabel(row.totals?.download)}</td>
                        <td>{formatBytesLabel(row.totals?.upload)}</td>
                        <td>{formatCount(row.totals?.packetsRx)}</td>
                        <td>{formatCount(row.totals?.packetsTx)}</td>
                        <td>{formatCount(row.samples)}</td>
                        <td>{row.last?.lastSeen ? formatPointTime(row.last.lastSeen * 1000) : '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={15} className="lp-na">No interfaces match this filter</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        ) : (
          <div className="dl-empty">
            No interface samples in the last {presetLabel.toLowerCase()}
          </div>
        )
      ) : null}
    </div>
  );
}
