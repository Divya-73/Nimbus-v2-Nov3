/**
 * Device / interface status — single source of truth (JS classifiers).
 *
 * Activity window (ACTIVITY_WINDOW_SECONDS in .env, default 240 = 4 min):
 *   online  → max(slu, lastupdated) >= (now - window)
 *   offline → max(slu, lastupdated) <  (now - window)
 *
 * Device status (getDeviceStatus):
 *   onboard → not assigned, slu > lastupdated, lastSeen > 0
 *             (Provisioning → On Board; not shown on Device Performance)
 *   up      → assigned + online  (Device Performance)
 *   down    → assigned + offline (Device Performance)
 *
 * Interface status (getLteInterfaceStatus / getLanInterfaceStatus) — dashboard / inventory:
 *   na   → iface not on this device (no slot and no iftrans_temp key), or not assigned
 *   LTE/WAN up/down → that iface exists and carrier is 1 / not 1
 *   LAN up     → assigned + online + any LAN port carrier == 1
 *   LAN down   → assigned + LAN present + (CPE offline OR no LAN port is up)
 *   Never UP while the CPE is offline.
 *
 * Presence is confirmed from devices.iftrans_temp keys (same snapshot Interface Health
 * uses for IP/MAC), plus inventory aliases (WAN1…WAN7, SIM1/SIM2, LAN1).
 * lo / ipsec / tun are not underlay columns — they stay on Interface Health.
 *
 * Rich LAN/LTE/WAN detail (getLanDetail / getLteDetail / getWanDetail) — live performance row:
 *   WAN is a port list (wan0, wan1, wan2, sfp-wan…), not a fixed WAN1/WAN2 pair.
 *   LTE1/LTE2 resolve to LTE1/LTE2 (or SIM1/SIM2) in iftrans_temp; missing radio → N/A.
 *   Live-performance filters (LAN/WAN/LTE):
 *     N/A  → iface kind not present on this device
 *     UP   → CPE online and at least one port of that kind is up
     *     DOWN → iface kind is present but not up (including CPE offline)
     *     Never UP while the CPE is offline.
 *
 * CPU/MEM: getCpuPercent / getMemoryUsagePercent.
 * SD-WAN / uptime: getSdwanStatus / getUptime (device list UI).
 * getUptime is reachability (online/offline session), not Linux uptime.
 */

/** Seconds of silence after which an assigned device is considered DOWN (from .env). */
export const ACTIVITY_WINDOW_SECONDS = (() => {
  const raw = Number(process.env.ACTIVITY_WINDOW_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 240;
})();

export const DEVICE_STATUS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  ONBOARD: 'onboard',
});

export const IFACE_STATUS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  NA: 'na',
});


function hasValue(value) {
  return value != null && String(value).trim() !== '';
}

function escapeWildcard(value) {
  return String(value).replace(/[\\*?]/g, '\\$&');
}

function toEpoch(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Unix seconds from seconds, milliseconds, numeric strings, or ISO dates.
 * Empty / unparseable values return null.
 */
export function toEpochSeconds(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }

  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  return null;
}

/** Unix cutoff: now − windowSeconds */
export function getActivityCutoff(windowSeconds = ACTIVITY_WINDOW_SECONDS) {
  const window = Number(windowSeconds);
  const seconds = Number.isFinite(window) && window > 0 ? window : ACTIVITY_WINDOW_SECONDS;
  return Math.floor(Date.now() / 1000) - seconds;
}

/** Session scope filters for device-style indices (orgId / branchId fields). */
export function buildSessionFilters(session = {}) {
  const filters = [];
  const { orgId, branchId, zone, region, tags } = session;

  if (hasValue(orgId)) {
    filters.push({ term: { 'orgId.keyword': String(orgId).trim() } });
  }
  if (hasValue(branchId)) {
    filters.push({ term: { 'branchId.keyword': String(branchId).trim() } });
  }
  if (hasValue(zone)) {
    filters.push({ term: { 'zone.keyword': String(zone).trim() } });
  }
  if (hasValue(region)) {
    filters.push({ term: { 'region.keyword': String(region).trim() } });
  }
  if (hasValue(tags)) {
    filters.push({
      wildcard: { 'tags.keyword': `*${escapeWildcard(String(tags).trim())}*` },
    });
  }

  return filters;
}

/**
 * Session scope for alarmlog docs:
 * org/branch are arrays [id, name]; tags is a string.
 */
export function buildAlarmSessionFilters(session = {}) {
  const filters = [];
  const { orgId, branchId, tags } = session;

  if (hasValue(orgId)) {
    filters.push({ term: { 'org.keyword': String(orgId).trim() } });
  }
  if (hasValue(branchId)) {
    filters.push({ term: { 'branch.keyword': String(branchId).trim() } });
  }
  if (hasValue(tags)) {
    filters.push({
      wildcard: { 'tags.keyword': `*${escapeWildcard(String(tags).trim())}*` },
    });
  }

  return filters;
}

export function isAssigned(device = {}) {
  return hasValue(device.orgId) && hasValue(device.branchId);
}

/** Slots mapped on assign (devices.LAN1 / WAN1… / SIM1…). */
export const ONBOARD_IFACE_SLOTS = Object.freeze([
  'LAN1',
  'WAN1',
  'WAN2',
  'WAN3',
  'WAN4',
  'SIM1',
  'SIM2',
]);

/** Link-quality bands stored on `devices.latency` / `devices.jitter` (ms). */
export const DEFAULT_LATENCY_SLA = Object.freeze({
  goodF: 0,
  goodT: 149,
  fairF: 150,
  fairT: 399,
  poorF: 400,
  poorT: 999,
});

export const DEFAULT_JITTER_SLA = Object.freeze({
  goodF: 0,
  goodT: 30,
  fairF: 31,
  fairT: 50,
  poorF: 51,
  poorT: 300,
});

const SLA_KEYS = Object.freeze(['goodF', 'goodT', 'fairF', 'fairT', 'poorF', 'poorT']);

function slaNumber(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Merge payload with defaults. Values are milliseconds. */
export function normalizeLinkSla(input, defaults) {
  const base = defaults || DEFAULT_LATENCY_SLA;
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const key of SLA_KEYS) {
    out[key] = slaNumber(src[key], base[key]);
  }
  return out;
}

/** Iface names the CPE already reported — never invent names. */
export function listedDeviceIfaces(device = {}) {
  const names = new Set();
  for (const name of Array.isArray(device.interfaces) ? device.interfaces : []) {
    const n = String(name || '').trim();
    if (n) names.add(n);
  }
  const temp = device.iftrans_temp && typeof device.iftrans_temp === 'object'
    ? device.iftrans_temp
    : {};
  for (const name of Object.keys(temp)) {
    const n = String(name || '').trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Map LAN/WAN/SIM slots to reported iface names.
 * Unknown names are dropped. Empty string clears the slot.
 */
export function normalizeOnboardIfaceMap(device = {}, payload = {}) {
  const allowed = new Set(listedDeviceIfaces(device));
  const src = payload && typeof payload === 'object' ? payload : {};
  const out = {};
  for (const slot of ONBOARD_IFACE_SLOTS) {
    if (!(slot in src)) continue;
    const value = String(src[slot] ?? '').trim();
    if (!value) {
      out[slot] = '';
      continue;
    }
    if (allowed.has(value)) out[slot] = value;
  }
  return out;
}

/** Safe CPE iface name for `devices.interface_name` keys. */
export const INTERFACE_NAME_KEY = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

function isSafeInterfaceName(value) {
  return INTERFACE_NAME_KEY.test(String(value || '').trim());
}

/** Operator options for `interface_name.<iface>.op` (service / ISP). */
export const INTERFACE_OPERATORS = Object.freeze([
  'Airtel',
  'Jio',
  'VI',
  'BSNL',
  'Tata',
  'Hathway',
  'ACT',
  'RailTel',
  'Sify',
  'Others',
  
]);

export function readInterfaceNameEntry(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      op: String(value.op ?? value.operator ?? value.label ?? value.name ?? '').trim(),
      con_id: String(value.con_id ?? value.serviceId ?? value.service_id ?? value.conn_id ?? '').trim(),
    };
  }
  const text = String(value ?? '').trim();
  return { op: text, con_id: '' };
}

export function formatInterfaceNameLabel(value) {
  const { op, con_id } = readInterfaceNameEntry(value);
  if (op && con_id) return `${op} · ${con_id}`;
  return op || con_id || '';
}

/**
 * Reported ifaces eligible for On Board `interface_name`.
 * Drops lo/tunnel names. Never invents names. Independent of LAN1/WAN1/SIM slots.
 */
export function listedAssignableIfaces(device = {}) {
  return listedDeviceIfaces(device).filter(
    (name) => isSafeInterfaceName(name) && !isIgnoredSummaryName(name)
  );
}

/**
 * Nested `devices.interface_name` — keys are real CPE names.
 * Values match the old inventory shape: `{ op, con_id }`.
 */
export function readInterfaceNameMap(device = {}) {
  const raw = device.interface_name;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key || '').trim();
    if (!name || !isSafeInterfaceName(name)) continue;
    const entry = readInterfaceNameEntry(value);
    if (!entry.op && !entry.con_id) continue;
    out[name] = entry;
  }
  return out;
}

export function countInterfaceMap(device = {}) {
  return Object.keys(readInterfaceNameMap(device)).length;
}

/**
 * Build `interface_name` from On Board / assignment body.
 * Writes `{ op, con_id }` per iface. Unknown / unsafe names are dropped.
 * Does not write LAN1/WAN1/SIM slots.
 */
export function normalizeInterfaceNameMap(device = {}, payload = {}) {
  const allowed = new Set(listedAssignableIfaces(device));
  const src = payload && typeof payload === 'object' ? payload : {};
  const raw = src.interface_name && typeof src.interface_name === 'object' && !Array.isArray(src.interface_name)
    ? src.interface_name
    : Array.isArray(src.assignments)
      ? Object.fromEntries(
          src.assignments
            .map((row) => [row?.name, row])
            .filter(([name]) => name)
        )
      : src;
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const name = String(key || '').trim();
    if (!allowed.has(name) || !isSafeInterfaceName(name)) continue;
    const entry = readInterfaceNameEntry(value);
    if (!entry.op) continue;
    out[name] = { op: entry.op, con_id: entry.con_id };
  }
  return out;
}

/**
 * Operator assignment for a reported CPE iface (display only).
 * slot = LAN1/WAN1/SIM* mapping. label = operator · service id from `interface_name`.
 * Classifiers must not use `interface_name` for UP/DOWN.
 */
export function assignedIfaceMeta(device = {}, ifaceName) {
  const name = String(ifaceName || '').trim();
  if (!name) return { slot: '', label: '', op: '', con_id: '' };
  const slots = [];
  for (const slot of ONBOARD_IFACE_SLOTS) {
    if (String(device[slot] || '').trim() === name) slots.push(slot);
  }
  const entry = readInterfaceNameMap(device)[name] || { op: '', con_id: '' };
  return {
    slot: slots.join(', '),
    label: formatInterfaceNameLabel(entry),
    op: entry.op,
    con_id: entry.con_id,
  };
}

/** OpenSearch clause: missing or empty orgId or branchId. */
export function unassignedMustClause() {
  return {
    bool: {
      should: [
        { bool: { must_not: [{ exists: { field: 'orgId' } }] } },
        { term: { 'orgId.keyword': '' } },
        { bool: { must_not: [{ exists: { field: 'branchId' } }] } },
        { term: { 'branchId.keyword': '' } },
      ],
      minimum_should_match: 1,
    },
  };
}

export function isOnline(device = {}, cutoff) {
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  return Math.max(toEpoch(device.slu), toEpoch(device.lastupdated)) >= activityCutoff;
}

function hasIfaceConfigured(device = {}, ifaceKey) {
  const value = String(device?.[ifaceKey] ?? '').trim();
  if (!value) return false;
  const n = value.toUpperCase();
  return n !== 'N/A' && n !== 'NA' && n !== '-' && n !== '0';
}

function isCarrierValueUp(carrier) {
  return carrier === 1 || carrier === 1n || String(carrier) === '1';
}

function isCarrierUp(device = {}, ifaceField) {
  const iface = device?.[ifaceField];
  if (!hasValue(iface)) return false;
  const carrier = device?.iftrans_temp?.[String(iface)]?.carrier;
  return isCarrierValueUp(carrier);
}

/**
 * Device status for one document: 'up' | 'down' | 'onboard' | null
 */
export function getDeviceStatus(device = {}, cutoff) {
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);

  if (!isAssigned(device)) {
    const slu = toEpoch(device.slu);
    const lu = toEpoch(device.lastupdated);
    if (slu > lu && Math.max(slu, lu) > 0) return DEVICE_STATUS.ONBOARD;
    return null;
  }

  return isOnline(device, activityCutoff) ? DEVICE_STATUS.UP : DEVICE_STATUS.DOWN;
}

/**
 * Interface status for one document: 'up' | 'down' | 'na'
 *
 *   na   → iface field empty (not installed) or not assigned
 *   up   → assigned + online + field set + carrier == 1
 *   down → assigned + field set + (offline or carrier not up)
 */
export function getInterfaceStatus(device = {}, ifaceKey, cutoff) {
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  if (!hasIfaceConfigured(device, ifaceKey)) return IFACE_STATUS.NA;
  if (!isAssigned(device)) return IFACE_STATUS.NA;
  if (!isOnline(device, activityCutoff)) return IFACE_STATUS.DOWN;
  if (!device?.iftrans_temp) return IFACE_STATUS.DOWN;
  return isCarrierUp(device, ifaceKey) ? IFACE_STATUS.UP : IFACE_STATUS.DOWN;
}

/** LTE interface status — SIM1/SIM2 slot, or LTE1/LTE2 in iftrans_temp. */
export function getLteInterfaceStatus(device = {}, simField = 'SIM1', cutoff) {
  const name = resolveLteIfaceName(device, simField);
  if (!name) return IFACE_STATUS.NA;
  return carrierStatusForIface(device, name, cutoff);
}

/**
 * LAN overall status — matches the ports we display.
 * Up if any LAN port has carrier; never Up while the CPE is offline.
 * Down if LAN is present and the CPE is offline or no port is up.
 */
export function getLanInterfaceStatus(device = {}, cutoff) {
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  if (!isAssigned(device)) return IFACE_STATUS.NA;

  const names = listLanInterfaceNames(device);
  if (!names.length) return getInterfaceStatus(device, 'LAN1', cutoff);

  if (!isOnline(device, activityCutoff)) return IFACE_STATUS.DOWN;
  const anyUp = names.some((name) => isCarrierValueUp(device?.iftrans_temp?.[name]?.carrier));
  return anyUp ? IFACE_STATUS.UP : IFACE_STATUS.DOWN;
}

/** Raw iftrans_temp payload for a device field (LAN1 / SIM1 / SIM2…). */
export function getIfacePayload(device = {}, ifaceField) {
  const key = device?.[ifaceField];
  if (!hasValue(key)) return null;
  return device?.iftrans_temp?.[String(key)] || null;
}

const NON_LAN_IFACE_FIELDS = ['SIM1', 'SIM2', 'SSTP', 'WAN1', 'WAN2', 'WAN3', 'WAN4', 'WAN5', 'WAN6', 'WAN7'];
const WAN_SLOT_FIELDS = ['WAN1', 'WAN2', 'WAN3', 'WAN4', 'WAN5', 'WAN6', 'WAN7'];

function assignedNonLanNames(device = {}) {
  const names = new Set();
  for (const field of NON_LAN_IFACE_FIELDS) {
    const value = String(device?.[field] || '').trim();
    if (value) names.add(value);
  }
  return names;
}

function isLanMemberName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  if (n.includes('eth')) return true;
  if (n === 'br-lan' || n.startsWith('br-lan.') || n.startsWith('br-lan:')) return true;
  return false;
}

/**
 * Every LAN-facing iface name for display: configured LAN1 first, then members
 * (eth*, br-lan*). WAN / LTE / SSTP names are excluded so pages never disagree.
 * Logical aliases like lan / lan1 are skipped when br-lan or eth* already exist.
 */
export function listLanInterfaceNames(device = {}) {
  const seen = new Set();
  const names = [];
  const skip = assignedNonLanNames(device);

  const add = (raw, force = false) => {
    const name = String(raw || '').trim();
    if (!name || seen.has(name)) return;
    if (!force && (skip.has(name) || !isLanMemberName(name))) return;
    seen.add(name);
    names.push(name);
  };

  for (const iface of Object.keys(device.iftrans_temp || {})) {
    add(iface, false);
  }

  const lan1 = String(device.LAN1 || '').trim();
  if (lan1 && seen.has(lan1)) {
    names.splice(0, names.length, lan1, ...names.filter((name) => name !== lan1));
  } else if (lan1 && (isLanMemberName(lan1) || names.length === 0)) {
    names.unshift(lan1);
  }

  return names;
}

function isIgnoredSummaryName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return true;
  if (n === 'lo' || n.startsWith('lo:')) return true;
  if (n.startsWith('ipsec') || n.startsWith('tun') || n.startsWith('vti') || n.startsWith('gre')) return true;
  return false;
}

function isLteMemberName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  if (n === 'lte' || /^lte\d+$/.test(n)) return true;
  if (n.startsWith('3g-lte')) return true;
  return false;
}

function lteSortKey(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n === 'lte1' || n.includes('lte1')) return 0;
  if (n === 'lte2' || n.includes('lte2')) return 1;
  return 2;
}

function isWanMemberName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  if (n === 'wan' || /^wan\d+$/.test(n)) return true;
  if (/^sfp-wan\d*$/.test(n)) return true;
  return false;
}

function wanSortKey(name) {
  const n = String(name || '').trim().toLowerCase();
  const wan = n.match(/^wan(\d+)$/);
  if (wan) return Number(wan[1]);
  if (n === 'wan') return 50;
  const sfp = n.match(/^sfp-wan(\d+)$/);
  if (sfp) return 100 + Number(sfp[1]);
  if (n.startsWith('sfp-wan')) return 199;
  return 200;
}

/**
 * Actual WAN ifaces for live performance: inventory WAN1…WAN7 if set, then
 * wan0/wan1/wan2/sfp-wan* from iftrans_temp. Hughes boxes often have wan0
 * with empty WAN1/WAN2 slots — Interface Health already lists those names.
 */
export function listWanInterfaceNames(device = {}) {
  const seen = new Set();
  const names = [];
  const add = (raw, force = false) => {
    const name = String(raw || '').trim();
    if (!name || seen.has(name) || isIgnoredSummaryName(name)) return;
    if (!force && !isWanMemberName(name)) return;
    if (isLanMemberName(name) || isLteMemberName(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (const field of WAN_SLOT_FIELDS) {
    if (hasIfaceConfigured(device, field)) add(device[field], true);
  }

  const discovered = Object.keys(device.iftrans_temp || {})
    .filter((name) => isWanMemberName(name) && !seen.has(name))
    .sort((a, b) => wanSortKey(a) - wanSortKey(b) || a.localeCompare(b));
  for (const name of discovered) add(name);

  return names;
}

export function listLteInterfaceNames(device = {}) {
  const seen = new Set();
  const names = [];
  const add = (raw, force = false) => {
    const name = String(raw || '').trim();
    if (!name || seen.has(name) || isIgnoredSummaryName(name)) return;
    if (!force && !isLteMemberName(name)) return;
    if (isLanMemberName(name) || isWanMemberName(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (const field of ['SIM1', 'SIM2']) {
    if (hasIfaceConfigured(device, field)) add(device[field], true);
  }

  const discovered = Object.keys(device.iftrans_temp || {})
    .filter((name) => isLteMemberName(name) && !seen.has(name))
    .sort((a, b) => lteSortKey(a) - lteSortKey(b) || a.localeCompare(b));
  for (const name of discovered) add(name);

  return names;
}

function resolveLteIfaceName(device = {}, simField = 'SIM1') {
  const field = String(simField || 'SIM1').toUpperCase() === 'SIM2' ? 'SIM2' : 'SIM1';
  if (hasIfaceConfigured(device, field)) return String(device[field]).trim();

  const names = listLteInterfaceNames(device);
  const prefer = field === 'SIM2' ? /lte2/i : /lte1/i;
  const otherField = field === 'SIM2' ? 'SIM1' : 'SIM2';
  const claimed = hasIfaceConfigured(device, otherField)
    ? String(device[otherField]).trim()
    : '';

  const preferred = names.find((name) => prefer.test(name) && name !== claimed);
  if (preferred) return preferred;

  if (field === 'SIM1') return names.find((name) => name !== claimed) || null;

  const sim1 = claimed && otherField === 'SIM1'
    ? claimed
    : (names.find((name) => /lte1/i.test(name)) || names[0] || '');
  return names.find((name) => name !== sim1) || null;
}

function portStatusLabel(status) {
  if (status === IFACE_STATUS.UP) return 'up';
  if (status === IFACE_STATUS.DOWN) return 'down';
  return 'n/a';
}

function ifaceIpv4(payload) {
  const raw = payload?.v4;
  if (raw == null) return '';
  const ip = String(raw).trim();
  if (!ip || ip === '0' || ip === '0.0.0.0' || ip === '-') return '';
  return ip;
}

function lastCarrierStatus(device = {}, ifaceName) {
  const carrier = device?.iftrans_temp?.[String(ifaceName)]?.carrier;
  return isCarrierValueUp(carrier) ? IFACE_STATUS.UP : IFACE_STATUS.DOWN;
}

function carrierStatusForIface(device = {}, ifaceName, cutoff) {
  if (!isAssigned(device)) return IFACE_STATUS.NA;
  if (!isOnline(device, cutoff)) return IFACE_STATUS.DOWN;
  return lastCarrierStatus(device, ifaceName);
}

function lastReportedCarrierHint(device, ifaceName) {
  return lastCarrierStatus(device, ifaceName) === IFACE_STATUS.UP
    ? 'last reported up'
    : 'last reported down';
}

function joinHint(...parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * LAN ports with per-iface carrier + IPv4 (same names everywhere).
 * IP sits on the iface that owns it (usually br-lan / LAN1). eth* members often have none.
 */
function ifaceLiveMetrics(payload = {}) {
  return {
    ip: ifaceIpv4(payload),
    latency: formatMsMetric(payload.rtmed),
    jitter: formatMsMetric(payload.twj),
    packetLoss: formatPercentMetric(payload.lostp),
  };
}

export function listLanInterfacePorts(device = {}, cutoff) {
  const names = listLanInterfaceNames(device);
  const ports = names.map((name) => {
    const status = carrierStatusForIface(device, name, cutoff);
    const payload = device?.iftrans_temp?.[name] || {};
    const assigned = assignedIfaceMeta(device, name);
    return {
      name,
      slot: assigned.slot,
      label: assigned.label,
      op: assigned.op,
      con_id: assigned.con_id,
      status,
      ...ifaceLiveMetrics(payload),
      hint: status === IFACE_STATUS.NA ? lastReportedCarrierHint(device, name) : '',
    };
  });

  if (ports.some((port) => port.ip)) return ports;

  const lan1Ip = ifaceIpv4(getIfacePayload(device, 'LAN1'));
  if (!lan1Ip || !ports.length) return ports;

  const bridge = ports.find((port) => /^br-lan/i.test(port.name)) || ports[0];
  bridge.ip = lan1Ip;
  return ports;
}

export function formatLanInterfaceLabel(device = {}, fallback = 'N/A', cutoff) {
  const ports = listLanInterfacePorts(device, cutoff);
  if (!ports.length) return fallback;
  return ports
    .map((port) => {
      const status = portStatusLabel(port.status);
      return port.ip ? `${port.name} ${status} ${port.ip}` : `${port.name} ${status}`;
    })
    .join(', ');
}

/**
 * LAN detail for live-performance UI.
 * Port chips stay N/A while the CPE is down (never UP).
 * Group/filter status: N/A only if this device has no LAN ifaces.
 */
export function getLanDetail(device = {}, cutoff) {
  const ports = listLanInterfacePorts(device, cutoff);
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  const online = isAssigned(device) && isOnline(device, activityCutoff);
  const group = liveGroupFromPorts(ports, online);
  const interfaces = formatLanInterfaceLabel(device, 'N/A', cutoff);
  const ip = ports.find((port) => port.ip)?.ip || ifaceIpv4(getIfacePayload(device, 'LAN1')) || '-';

  return {
    status: statusLabelUpper(group.status),
    interfaces,
    ports,
    ip,
    color: groupColor(group.status),
    present: group.present,
    stale: group.stale,
  };
}

function formatMsMetric(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(2)} ms`;
}

function formatPercentMetric(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function linkStatusLabel(payload) {
  if (!payload) return '—';
  if (payload.carrier === 0 || String(payload.carrier) === '0') return 'Down';
  if (payload.status === 0 || String(payload.status) === '0') return 'Unreachable';
  if (payload.status === 1 || String(payload.status) === '1') return 'Reachable';
  return 'Unavailable';
}

function statusLabelUpper(status) {
  if (status === IFACE_STATUS.UP) return 'UP';
  if (status === IFACE_STATUS.DOWN) return 'DOWN';
  return 'N/A';
}

function groupColor(status) {
  if (status === IFACE_STATUS.UP) return 'green';
  if (status === IFACE_STATUS.DOWN) return 'red';
  return 'gray';
}

/** N/A only when this iface kind is missing. Present + CPE down → DOWN, never N/A. */
function liveGroupFromPorts(ports, online) {
  const present = Array.isArray(ports) && ports.length > 0;
  if (!present) {
    return { present: false, status: IFACE_STATUS.NA, stale: false };
  }
  if (!online) {
    return { present: true, status: IFACE_STATUS.DOWN, stale: true };
  }
  const up = ports.some((port) => port.status === IFACE_STATUS.UP);
  return {
    present: true,
    status: up ? IFACE_STATUS.UP : IFACE_STATUS.DOWN,
    stale: false,
  };
}

function listLteInterfacePorts(device = {}, cutoff) {
  return listLteInterfaceNames(device).map((name) => {
    const payload = device?.iftrans_temp?.[name] || {};
    const status = carrierStatusForIface(device, name, cutoff);
    let signal = '—';
    if (payload.sig !== undefined && payload.sig !== null && Number.isFinite(Number(payload.sig))) {
      signal = `${payload.sig} dBm`;
    }
    const operator = payload.op && String(payload.op) !== '0' ? payload.op : '—';
    const assigned = assignedIfaceMeta(device, name);
    return {
      name,
      slot: assigned.slot,
      label: assigned.label,
      op: assigned.op,
      con_id: assigned.con_id,
      status,
      ...ifaceLiveMetrics(payload),
      signal,
      operator,
      linkStatus: linkStatusLabel(payload),
      hint: joinHint(
        operator !== '—' ? operator : '',
        signal !== '—' ? signal : '',
        status === IFACE_STATUS.NA ? lastReportedCarrierHint(device, name) : '',
      ),
    };
  });
}

/**
 * LTE detail for live-performance UI: every LTE radio this device actually has.
 * Missing LTE → N/A. Present but CPE down → DOWN (not N/A).
 */
export function getLteDetail(device = {}, cutoff) {
  const ports = listLteInterfacePorts(device, cutoff);
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  const online = isAssigned(device) && isOnline(device, activityCutoff);
  const group = liveGroupFromPorts(ports, online);
  const interfaces = ports
    .map((port) => {
      const label = portStatusLabel(port.status);
      return port.ip ? `${port.name} ${label} ${port.ip}` : `${port.name} ${label}`;
    })
    .join(', ');

  return {
    status: statusLabelUpper(group.status),
    present: group.present,
    ports,
    interfaces: interfaces || 'N/A',
    ip: ports.find((port) => port.ip)?.ip || '-',
    color: groupColor(group.status),
    stale: group.stale,
  };
}

function listWanInterfacePorts(device = {}, cutoff) {
  return listWanInterfaceNames(device).map((name) => {
    const payload = device?.iftrans_temp?.[name] || {};
    const status = carrierStatusForIface(device, name, cutoff);
    const assigned = assignedIfaceMeta(device, name);
    return {
      name,
      slot: assigned.slot,
      label: assigned.label,
      op: assigned.op,
      con_id: assigned.con_id,
      status,
      ...ifaceLiveMetrics(payload),
      linkStatus: linkStatusLabel(payload),
      hint: status === IFACE_STATUS.NA ? lastReportedCarrierHint(device, name) : '',
    };
  });
}

/**
 * WAN detail for live-performance UI: every WAN iface this device actually has
 * (wan0/wan1/wan2/sfp-wan*, plus WAN1…WAN7 aliases).
 * Missing WAN → N/A. Present but CPE down → DOWN (not N/A).
 */
export function getWanDetail(device = {}, cutoff) {
  const ports = listWanInterfacePorts(device, cutoff);
  const activityCutoff = cutoff == null ? getActivityCutoff() : Number(cutoff);
  const online = isAssigned(device) && isOnline(device, activityCutoff);
  const group = liveGroupFromPorts(ports, online);
  const interfaces = ports
    .map((port) => {
      const label = portStatusLabel(port.status);
      return port.ip ? `${port.name} ${label} ${port.ip}` : `${port.name} ${label}`;
    })
    .join(', ');

  return {
    status: statusLabelUpper(group.status),
    present: group.present,
    ports,
    interfaces: interfaces || 'N/A',
    ip: ports.find((port) => port.ip)?.ip || '-',
    color: groupColor(group.status),
    stale: group.stale,
  };
}

/**
 * Live-performance LAN/WAN/LTE filter value.
 * N/A  = this kind of iface is not on the device.
 * UP   = CPE is online and at least one port is up.
 * DOWN = the iface exists and is not up, including when the CPE is offline.
 */
export function liveLinkFilterStatus(detail = {}) {
  const ports = Array.isArray(detail.ports) ? detail.ports : [];
  const present = detail.present === true || (detail.present !== false && ports.length > 0);
  if (!present) return 'N/A';
  if (detail.stale === true) return 'DOWN';
  const status = String(detail.status || '').toUpperCase();
  if (status === 'UP') return 'UP';
  if (status === 'DOWN') return 'DOWN';
  return 'N/A';
}

/** CPU % from device.cpu.per (0 when missing). */
export function getCpuPercent(device = {}) {
  const n = Number(device?.cpu?.per);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * Memory usage % — OpenSearch stores free % in mem.mper; usage = 100 − mper.
 */
export function getMemoryUsagePercent(device = {}) {
  const memPer = device?.mem?.mper;
  if (memPer === null || memPer === undefined || !Number.isFinite(Number(memPer))) return 0;
  return Math.max(0, 100 - Number(memPer));
}

export function lastSeenEpoch(device = {}) {
  return Math.max(toEpoch(device.slu), toEpoch(device.lastupdated));
}

/** Heartbeat samples to walk when finding the current online session. */
export const HEARTBEAT_SAMPLE_LIMIT = 100;

/**
 * Start of the current reachable session from newest-first heartbeat timestamps.
 * A gap longer than the activity window is a down period — session starts after it.
 * If the newest window of samples is contiguous and truncated, returns null so
 * callers can fall back to OS uptime.
 */
export function onlineSinceFromHeartbeats(
  lastSeen,
  samplesNewestFirst = [],
  windowSeconds = ACTIVITY_WINDOW_SECONDS,
  sampleLimit = HEARTBEAT_SAMPLE_LIMIT
) {
  const window = Number(windowSeconds) > 0 ? Number(windowSeconds) : ACTIVITY_WINDOW_SECONDS;
  const seen = new Set();
  const points = [];
  for (const value of [lastSeen, ...(samplesNewestFirst || [])]) {
    const n = toEpochSeconds(value);
    if (n == null || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    points.push(n);
  }
  points.sort((a, b) => b - a);
  if (!points.length) return null;

  let start = points[0];
  let gapFound = false;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (points[i] - points[i + 1] > window) {
      start = points[i];
      gapFound = true;
      break;
    }
    start = points[i + 1];
  }

  if (!gapFound && points.length >= sampleLimit) return null;
  return start;
}

/** Human-readable duration between two unix timestamps. */
export function formatTimeDiff(fromEpoch, toEpoch = Math.floor(Date.now() / 1000)) {
  const from = toEpochSeconds(fromEpoch) ?? 0;
  const to = toEpochSeconds(toEpoch) ?? 0;
  const sec = Math.max(0, to - from);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

/**
 * SD-WAN link status for device list UI.
 * Derived from getDeviceStatus (assigned + activity window) — not a separate signal.
 * @returns {{ status: 'UP'|'DOWN', color: 'green'|'red' }}
 */
export function getSdwanStatus(device = {}, cutoff) {
  const status = getDeviceStatus(device, cutoff);
  const up = status === DEVICE_STATUS.UP;
  return {
    status: up ? 'UP' : 'DOWN',
    color: up ? 'green' : 'red',
  };
}

/**
 * Reachability duration for the live table / device hero.
 * Up   → time since this CPE last came online (onlineSince), else OS uptime
 * Down → time since last heartbeat: max(slu, lastupdated)
 *
 * Do not use Linux uptime after a WAN flap: the box can stay up for days
 * while SD-WAN was only reachable again a few minutes ago.
 */
export function getUptime(device = {}, cutoff, onlineSince = null) {
  const now = Math.floor(Date.now() / 1000);
  const status = getDeviceStatus(device, cutoff);
  let from;

  if (status === DEVICE_STATUS.UP) {
    const session = toEpochSeconds(onlineSince);
    const uptimeSecs = toEpoch(device.uptime);
    const boot = toEpoch(device.cpu?.btime);

    if (session != null && session > 0) from = session;
    else if (uptimeSecs > 0) from = now - uptimeSecs;
    else from = boot || now;

    if (boot > 0 && from < boot) from = boot;
    if (uptimeSecs > 0) {
      const osFrom = now - uptimeSecs;
      if (from < osFrom) from = osFrom;
    }
  } else {
    const lastSeen = lastSeenEpoch(device);
    from = lastSeen > 0 ? lastSeen : now;
  }

  return formatTimeDiff(from, now);
}
