import * as XLSX from 'xlsx';
import {
  fetchDeviceAlarms,
  fetchDeviceDataUsage,
  fetchDeviceHealth,
  fetchDeviceInterfaceHealth,
  fetchDeviceIpUsage,
  fetchDeviceJobs,
  fetchDeviceLinkHealth,
  fetchDeviceLogs,
  fetchDeviceTraffic,
} from '../../../../api/performance';
import {
  formatBytesLabel,
  formatCount,
  formatMs,
  formatPercentLabel,
  formatPortLabel,
  formatRateLabel,
  carrierStatusLabel,
  probeStatusLabel,
  statusLabel,
  tagList,
} from './format';
import { alarmTableRows, jobTableRows, logTableRows, stampFilename } from './tableExport';

const TABLE_CAP = 200;

export const REPORT_SECTIONS = [
  { id: 'general', label: 'General details', hint: 'Inventory, IPs, identity' },
  { id: 'health', label: 'Device health', hint: 'CPU / memory charts' },
  { id: 'links', label: 'Link health', hint: 'Probe reachability, latency, and loss' },
  { id: 'interfaces', label: 'Interface health', hint: 'Carrier link status and traffic' },
  { id: 'traffic', label: 'Traffic', hint: 'Throughput and packet charts' },
  { id: 'usage', label: 'Data usage', hint: 'Category, protocol, IP charts' },
  { id: 'alarms', label: 'Alarms', hint: 'Severity, status, type charts' },
  { id: 'logs', label: 'Logs', hint: 'Level mix plus syslog table' },
  { id: 'jobs', label: 'Task history', hint: 'Template, reboot, group actions' },
];

export const DEFAULT_REPORT_SECTIONS = REPORT_SECTIONS
  .filter((item) => item.id !== 'logs')
  .map((item) => item.id);

function dash(value) {
  if (value == null || value === '' || value === 'N/A') return '—';
  return String(value);
}

function sheetName(name) {
  return String(name || 'Sheet').replace(/[\\/?*[\]]/g, ' ').slice(0, 31);
}

function addSheet(wb, name, rows) {
  const data = rows?.length ? rows : [{ Note: 'No data in this range' }];
  const ws = XLSX.utils.json_to_sheet(data);
  const keys = Object.keys(data[0] || {});
  ws['!cols'] = keys.map((key) => ({ wch: Math.min(40, Math.max(12, key.length + 2)) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
}

function kvRows(pairs) {
  return pairs.map(([Field, Value]) => ({ Field, Value: dash(Value) }));
}

function categoryRows(byCategory = {}) {
  return Object.entries(byCategory)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 15)
    .map(([name, total]) => ({ Category: name, Total: formatBytesLabel(total) }));
}

function usageRows(list, labelOf) {
  return (list || [])
    .filter((row) => Number(row.total) > 0)
    .slice(0, 15)
    .map((row) => ({
      Name: labelOf(row),
      Download: formatBytesLabel(row.download),
      Upload: formatBytesLabel(row.upload),
      Total: formatBytesLabel(row.total),
    }));
}

function generalRows(device = {}) {
  const ips = Array.isArray(device.ips) ? device.ips.join(', ') : '';
  const tags = tagList(device.tags).join(', ');
  return kvRows([
    ['Hostname', device.hostname],
    ['Device ID', device.id],
    ['Status', statusLabel(device.status)],
    ['Organization', device.orgName || device.org],
    ['Org ID', device.orgId],
    ['Branch', device.branch],
    ['Branch ID', device.branchId],
    ['Zone', device.zone],
    ['Region', device.region],
    ['Model', device.model],
    ['Manufacturer', device.manufacturer],
    ['Version', device.version],
    ['Site ID', device.siteId],
    ['GUI IP', device.guiIp],
    ['IPs', ips],
    ['Tags', tags],
    ['Last seen', device.lastSeen],
    ['Last updated', device.lastUpdated],
    ['Uptime', device.uptime],
  ]);
}

async function settled(label, task) {
  try {
    return { ok: true, label, data: await task() };
  } catch (err) {
    return { ok: false, label, error: err.message || `Failed to load ${label}` };
  }
}

export async function collectDeviceReport({ device, deviceId, range, selected }) {
  const want = new Set(selected || []);
  const id = deviceId || device?.id;
  const jobs = [];

  if (want.has('health')) {
    jobs.push(settled('health', () => fetchDeviceHealth(id, range)));
  }
  if (want.has('links')) {
    jobs.push(settled('links', () => fetchDeviceLinkHealth(id, range)));
  }
  if (want.has('interfaces')) {
    jobs.push(settled('interfaces', () => fetchDeviceInterfaceHealth(id, range)));
  }
  if (want.has('traffic')) {
    jobs.push(settled('traffic', () => fetchDeviceTraffic(id, range)));
  }
  if (want.has('usage')) {
    jobs.push(settled('usage', async () => {
      const [usage, ipUsage] = await Promise.all([
        fetchDeviceDataUsage(id, range),
        fetchDeviceIpUsage(id, range),
      ]);
      return { usage, ips: ipUsage?.ips || [] };
    }));
  }
  if (want.has('alarms')) {
    jobs.push(settled('alarms', () => fetchDeviceAlarms(id, {
      ...range,
      page: 1,
      pageSize: TABLE_CAP,
    })));
  }
  if (want.has('logs')) {
    jobs.push(settled('logs', () => fetchDeviceLogs(id, {
      ...range,
      page: 1,
      pageSize: TABLE_CAP,
    })));
  }
  if (want.has('jobs')) {
    jobs.push(settled('jobs', () => fetchDeviceJobs(id, {
      ...range,
      page: 1,
      pageSize: TABLE_CAP,
    })));
  }

  const results = await Promise.all(jobs);
  const byId = Object.fromEntries(results.map((item) => [item.label, item]));
  return {
    device,
    range,
    selected: [...want],
    hostname: device?.hostname || results.find((item) => item.data?.hostname)?.data?.hostname || id,
    byId,
  };
}

export function sectionTables(report) {
  const { device, byId, selected } = report;
  const out = [];

  if (selected.includes('general')) {
    out.push({ id: 'general', title: 'General details', rows: generalRows(device) });
  }
  if (selected.includes('health')) {
    const item = byId.health;
    if (!item?.ok) {
      out.push({ id: 'health', title: 'Device health', rows: kvRows([['Error', item?.error]]) });
    } else {
      const s = item.data?.summary || {};
      out.push({
        id: 'health',
        title: 'Device health',
        rows: kvRows([
          ['Samples', s.points],
          ['CPU min', formatPercentLabel(s.cpuMin)],
          ['CPU avg', formatPercentLabel(s.cpuAvg)],
          ['CPU max', formatPercentLabel(s.cpuMax)],
          ['Memory min', formatPercentLabel(s.memoryMin)],
          ['Memory avg', formatPercentLabel(s.memoryAvg)],
          ['Memory max', formatPercentLabel(s.memoryMax)],
        ]),
      });
    }
  }
  if (selected.includes('links')) {
    const item = byId.links;
    if (!item?.ok) {
      out.push({ id: 'links', title: 'Link health', rows: kvRows([['Error', item?.error]]) });
    } else {
      const paths = (item.data?.paths || []).map((row) => ({
        Path: row.name,
        Kind: row.kind,
        'Probe status': probeStatusLabel(row.lastStatus),
        Target: row.target,
        'Probe uptime %': formatPercentLabel(row.uptimePercentage),
        'Latency avg': formatMs(row.latency?.avg),
        'Latency max': formatMs(row.latency?.max),
        'Jitter avg': formatMs(row.jitter?.avg),
        'Loss avg': formatPercentLabel(row.loss?.avg),
      }));
      const radios = (item.data?.radios || []).map((row) => ({
        Radio: row.name,
        Operator: row.operator,
        SIM: row.sim,
        Network: row.network,
        Band: row.band,
        RSRP: dash(row.rsrp?.last),
        SINR: dash(row.sinr?.last),
      }));
      out.push({
        id: 'links',
        title: 'Link health — probes',
        rows: paths,
        empty: 'No link probes in this range',
      });
      if (radios.length) {
        out.push({ id: 'radios', title: 'Link health — radios', rows: radios });
      }
    }
  }
  if (selected.includes('interfaces')) {
    const item = byId.interfaces;
    if (!item?.ok) {
      out.push({ id: 'interfaces', title: 'Interface health', rows: kvRows([['Error', item?.error]]) });
    } else {
      out.push({
        id: 'interfaces',
        title: 'Interface health',
        rows: (item.data?.interfaces || []).map((row) => ({
          Interface: row.name,
          Carrier: carrierStatusLabel(row.lastStatus),
          IP: row.ip,
          MAC: row.mac,
          'Carrier uptime %': formatPercentLabel(row.uptimePercentage),
          Download: formatBytesLabel(row.totals?.download),
          Upload: formatBytesLabel(row.totals?.upload),
        })),
        empty: 'No interfaces in this range',
      });
    }
  }
  if (selected.includes('traffic')) {
    const item = byId.traffic;
    if (!item?.ok) {
      out.push({ id: 'traffic', title: 'Traffic', rows: kvRows([['Error', item?.error]]) });
    } else {
      const s = item.data?.summary || {};
      out.push({
        id: 'traffic',
        title: 'Traffic',
        rows: kvRows([
          ['Samples', s.points],
          ['Download total', formatBytesLabel(s.totals?.download)],
          ['Upload total', formatBytesLabel(s.totals?.upload)],
          ['Packets RX', formatCount(s.totals?.packetsRx)],
          ['Packets TX', formatCount(s.totals?.packetsTx)],
          ['Download avg rate', formatRateLabel(s.dataPlane?.rx?.avg)],
          ['Upload avg rate', formatRateLabel(s.dataPlane?.tx?.avg)],
        ]),
      });
    }
  }
  if (selected.includes('usage')) {
    const item = byId.usage;
    if (!item?.ok) {
      out.push({ id: 'usage', title: 'Data usage', rows: kvRows([['Error', item?.error]]) });
    } else {
      const usage = item.data?.usage || {};
      out.push({
        id: 'usage-summary',
        title: 'Data usage — summary',
        rows: kvRows([
          ['Total bytes', formatBytesLabel(usage.total?.bytes)],
          ['Download', formatBytesLabel(usage.total?.download)],
          ['Upload', formatBytesLabel(usage.total?.upload)],
          ['Packets', formatCount(usage.total?.packets)],
          ['Sources', formatCount(usage.total?.sources)],
          ['Destinations', formatCount(usage.total?.destinations)],
        ]),
      });
      out.push({
        id: 'usage-cat',
        title: 'Data usage — categories',
        rows: categoryRows(usage.byCategory),
        empty: 'No category usage in this range',
      });
      out.push({
        id: 'usage-proto',
        title: 'Data usage — protocols',
        rows: usageRows(usage.protocols, (row) => row.name || 'Unknown'),
        empty: 'No protocol usage in this range',
      });
      out.push({
        id: 'usage-port',
        title: 'Data usage — ports',
        rows: usageRows(usage.ports, (row) => formatPortLabel(row.port)),
        empty: 'No port usage in this range',
      });
      out.push({
        id: 'usage-ip',
        title: 'Data usage — IPs',
        rows: usageRows(item.data?.ips, (row) => row.ip || 'Unknown'),
        empty: 'No IP usage in this range',
      });
    }
  }
  if (selected.includes('alarms')) {
    const item = byId.alarms;
    if (!item?.ok) {
      out.push({ id: 'alarms', title: 'Alarms', rows: kvRows([['Error', item?.error]]) });
    } else {
      const total = Number(item.data?.total) || 0;
      const rows = alarmTableRows(item.data?.alarms || []);
      out.push({
        id: 'alarms',
        title: total > rows.length ? `Alarms (first ${rows.length} of ${total})` : 'Alarms',
        rows,
        empty: 'No alarms in this range',
      });
    }
  }
  if (selected.includes('logs')) {
    const item = byId.logs;
    if (!item?.ok) {
      out.push({ id: 'logs', title: 'Logs', rows: kvRows([['Error', item?.error]]) });
    } else {
      const total = Number(item.data?.total) || 0;
      const rows = logTableRows(item.data?.logs || []);
      out.push({
        id: 'logs',
        title: total > rows.length ? `Logs (first ${rows.length} of ${total})` : 'Logs',
        rows,
        empty: 'No logs in this range',
      });
    }
  }
  if (selected.includes('jobs')) {
    const item = byId.jobs;
    if (!item?.ok) {
      out.push({ id: 'jobs', title: 'Task history', rows: kvRows([['Error', item?.error]]) });
    } else {
      const total = Number(item.data?.total) || 0;
      const summary = item.data?.summary || {};
      const rows = jobTableRows(item.data?.jobs || []);
      out.push({
        id: 'jobs-summary',
        title: 'Task history — summary',
        rows: kvRows([
          ['Total', total],
          ['Success', summary.success],
          ['Failed', summary.failed],
          ['Pending', summary.pending],
        ]),
      });
      out.push({
        id: 'jobs',
        title: total > rows.length ? `Task history (first ${rows.length} of ${total})` : 'Task history',
        rows,
        empty: 'No tasks in this range',
      });
    }
  }

  return out;
}

export function downloadDeviceReportExcel(report) {
  const wb = XLSX.utils.book_new();
  const from = new Date((report.range?.from || 0) * 1000).toLocaleString();
  const to = new Date((report.range?.to || 0) * 1000).toLocaleString();
  addSheet(wb, 'Summary', kvRows([
    ['Hostname', report.hostname],
    ['Device ID', report.device?.id],
    ['Generated', new Date().toLocaleString()],
    ['From', from],
    ['To', to],
    ['Sections', report.selected.join(', ')],
  ]));
  for (const section of sectionTables(report)) {
    addSheet(wb, section.title, section.rows?.length ? section.rows : [{ Note: section.empty || 'No data' }]);
  }
  XLSX.writeFile(wb, stampFilename(`device-report-${report.hostname}`, 'xlsx'));
}
