import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import { buildSessionFilters, isAssigned } from '../config/deviceStatusConfig.js';

/** Minimal fields needed for remote GUI access. */
const DEVICE_GUI_SOURCE = ['sysname', 'orgId', 'branchId', 'ips'];

/** Normalize device `ips` to a clean string array. */
export function normalizeIps(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[\s,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** All IPv4 addresses on a device (deduped). Order preserved from source. */
export function listIpv4(ips = []) {
  const seen = new Set();
  const out = [];
  for (const ip of normalizeIps(ips)) {
    if (!IPV4_RE.test(ip) || seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }
  return out;
}

/**
 * Prefer first usable IPv4 for display / single-IP convenience (skip link-local).
 * Do not use alone when multiple IPs exist — let the user choose.
 */
export function pickGuiIp(ips = []) {
  const list = listIpv4(ips);
  const ipv4 = list.find((ip) => !ip.startsWith('169.254.'));
  if (ipv4) return ipv4;
  const all = normalizeIps(ips);
  const ipv6 = all.find((ip) => ip.includes(':') && !ip.toLowerCase().startsWith('fe80:'));
  return ipv6 || list[0] || '';
}

/**
 * Resolve GUI IP: use explicit selection if it belongs to the device, else sole IPv4.
 */
export function resolveGuiIp(ips = [], selectedIp = '') {
  const all = normalizeIps(ips);
  const ipv4 = listIpv4(ips);
  const wanted = String(selectedIp || '').trim();
  if (wanted) {
    if (all.includes(wanted) || ipv4.includes(wanted)) return wanted;
    throw new Error('Selected IP is not assigned to this device');
  }
  if (ipv4.length === 1) return ipv4[0];
  if (ipv4.length > 1) {
    throw new Error('Multiple IPs found — select which IP to open for GUI');
  }
  return '';
}

/**
 * Load device GUI access info (scoped). Used by GUI session creation — not the list mapper.
 * @returns {{ id, hostname, orgId, branchId, ips, guiIp }}
 */
export async function getDeviceGuiAccess(deviceId, session = {}) {
  if (!deviceId || String(deviceId).trim() === '') {
    throw new Error('Device id is required');
  }

  const id = String(deviceId).trim();
  let body;

  try {
    ({ body } = await client.get({
      index: INDICES.DEVICES,
      id,
      _source_includes: DEVICE_GUI_SOURCE,
    }));
  } catch (err) {
    if (err?.meta?.statusCode === 404 || err?.statusCode === 404) {
      throw new Error('Device not found');
    }
    throw err;
  }

  if (!body?.found) {
    throw new Error('Device not found');
  }

  const src = body._source || {};
  if (!isAssigned(src)) {
    throw new Error('Device not found');
  }

  const scopeFilters = buildSessionFilters(session);
  if (scopeFilters.length) {
    const { body: check } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: 1,
        query: {
          bool: {
            filter: [...scopeFilters, { ids: { values: [body._id] } }],
          },
        },
        _source: false,
      },
    });
    if (!(check.hits?.hits || []).length) {
      throw new Error('Device not found');
    }
  }

  const ips = normalizeIps(src.ips);
  const ipv4 = listIpv4(ips);
  const guiIp = pickGuiIp(ips);

  return {
    id: body._id,
    hostname: src.sysname || 'Unknown',
    orgId: src.orgId || '',
    branchId: src.branchId || '',
    ips,
    ipv4,
    guiIp,
  };
}
