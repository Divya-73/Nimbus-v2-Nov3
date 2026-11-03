import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Prefer device.org when it is a real label (not blank / id-as-name / UUID).
 */
export function orgDisplayName(device = {}) {
  const name = device.org != null ? String(device.org).trim() : '';
  if (!name) return null;
  const id = device.orgId != null ? String(device.orgId).trim() : '';
  if (id && name === id) return null;
  if (UUID_RE.test(name)) return null;
  return name;
}

/**
 * orgId → human name from the org index.
 */
export async function fetchOrgNamesByIds(orgIds) {
  const ids = [...new Set((orgIds || []).filter(Boolean).map(String))];
  const map = new Map();
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.ORGANIZATIONS,
      body: {
        size: Math.min(ids.length, 10000),
        query: { ids: { values: ids } },
        _source: ['org_name', 'org'],
      },
    });

    for (const hit of body.hits?.hits || []) {
      const src = hit._source || {};
      const name =
        (src.org_name != null && String(src.org_name).trim()) ||
        (src.org != null && String(src.org).trim()) ||
        '';
      if (name && !UUID_RE.test(name)) map.set(String(hit._id), name);
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

/**
 * Device org label for rollups (same idea as resolveBranchName):
 * Prefer org-index name by orgId so blank / inconsistent device.org
 * labels still land in one org bucket (matches Org List).
 * Fallback: valid device.org.
 */
export function resolveOrgName(device = {}, orgNamesById = new Map()) {
  const id = device.orgId != null ? String(device.orgId).trim() : '';
  if (id) {
    const fromIndex = orgNamesById.get(id);
    if (fromIndex) return fromIndex;
  }
  return orgDisplayName(device);
}
