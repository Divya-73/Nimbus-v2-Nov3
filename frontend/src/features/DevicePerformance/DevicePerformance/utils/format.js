export function isEmpty(value) {
  return (
    value == null ||
    value === '' ||
    value === 'N/A' ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function displayOrNa(value) {
  if (isEmpty(value)) return null;
  return value;
}

export function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'up') return 'Online';
  if (s === 'down') return 'Offline';
  if (s === 'onboard') return 'Onboard';
  return status || 'Unknown';
}

/** twtrans probe reachability (1 = target responds, 0 = loss / timeout). */
export function probeStatusLabel(value) {
  if (value === 1) return 'Reachable';
  if (value === 0) return 'Unreachable';
  return '—';
}

/** nettrans carrier / physical link (1 = link up, 0 = link down). */
export function carrierStatusLabel(value) {
  if (value === 1) return 'Up';
  if (value === 0) return 'Down';
  return '—';
}

export function parsePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function formatPercentLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toFixed(2)}%`;
}

export function formatBytesLabel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return 'N/A';
  if (n < 1000) return `${Math.round(n)} B`;
  if (n < 1e6) return `${(n / 1000).toFixed(2)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
}

export function bytesAxisScale(peak) {
  const n = Number(peak);
  if (!Number.isFinite(n) || n < 1000) return { div: 1, suffix: 'B' };
  if (n < 1e6) return { div: 1000, suffix: 'KB' };
  if (n < 1e9) return { div: 1e6, suffix: 'MB' };
  return { div: 1e9, suffix: 'GB' };
}

const PORT_NAMES = {
  22: 'SSH',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  80: 'HTTP',
  110: 'POP3',
  137: 'NetBIOS',
  138: 'NetBIOS',
  139: 'NetBIOS',
  123: 'NTP',
  143: 'IMAP',
  161: 'SNMP',
  389: 'LDAP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP',
  993: 'IMAPS',
  1194: 'OpenVPN',
  1433: 'SQL Server',
  1883: 'MQTT',
  1900: 'SSDP',
  3306: 'MySQL',
  3389: 'RDP',
  3702: 'WS-Discovery',
  5060: 'SIP',
  5432: 'PostgreSQL',
  5672: 'AMQP',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP-alt',
  8443: 'HTTPS-alt',
  8883: 'MQTT-TLS',
  9200: 'OpenSearch',
  9300: 'OpenSearch',
};

export function formatPortLabel(port) {
  const n = Number(port);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const name = PORT_NAMES[n];
  return name ? `${n} (${name})` : String(n);
}

export function formatLinkSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `${n / 1e9} Gbps`;
  if (n >= 1e6) return `${n / 1e6} Mbps`;
  if (n >= 1e3) return `${n / 1e3} Kbps`;
  return `${n} bps`;
}

export function formatDuration(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  if (!Number.isFinite(n)) return 'N/A';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 'N/A';
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1e6).toFixed(1)}M`;
}

export function formatRateLabel(bytesPerSec) {
  const n = Number(bytesPerSec);
  if (!Number.isFinite(n) || n < 0) return 'N/A';
  if (n < 1000) return `${n.toFixed(2)} B/s`;
  if (n < 1e6) return `${(n / 1000).toFixed(2)} KB/s`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)} MB/s`;
  return `${(n / 1e9).toFixed(2)} GB/s`;
}

export function formatMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toFixed(2)} ms`;
}

export function formatDbm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toFixed(2)} dBm`;
}

export function formatDb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toFixed(2)} dB`;
}

export function formatPacketRate(packetsPerSec) {
  const n = Number(packetsPerSec);
  if (!Number.isFinite(n) || n < 0) return 'N/A';
  if (n < 1000) return `${n.toFixed(2)} pkt/s`;
  if (n < 1e6) return `${(n / 1000).toFixed(2)} Kpkt/s`;
  return `${(n / 1e6).toFixed(2)} Mpkt/s`;
}

export function packetAxisScale(peak) {
  const n = Number(peak);
  if (!Number.isFinite(n) || n < 1000) return { div: 1, suffix: 'pkt/s' };
  if (n < 1e6) return { div: 1000, suffix: 'Kpkt/s' };
  return { div: 1e6, suffix: 'Mpkt/s' };
}

export function rateAxisScale(peak) {
  const n = Number(peak);
  if (!Number.isFinite(n) || n < 1000) return { div: 1, suffix: 'B/s' };
  if (n < 1e6) return { div: 1000, suffix: 'KB/s' };
  if (n < 1e9) return { div: 1e6, suffix: 'MB/s' };
  return { div: 1e9, suffix: 'GB/s' };
}

export function tagList(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (!tags || tags === 'N/A') return [];
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
