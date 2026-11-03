import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Prefer device.branch when it is a real label (not blank / id-as-name / UUID).
 */
export function branchDisplayName(device = {}) {
  const name = device.branch != null ? String(device.branch).trim() : '';
  if (!name) return null;
  const id = device.branchId != null ? String(device.branchId).trim() : '';
  if (id && name === id) return null;
  if (UUID_RE.test(name)) return null;
  return name;
}

/**
 * branchId → human name from the branch index.
 */
export async function fetchBranchNamesByIds(branchIds) {
  const ids = [...new Set((branchIds || []).filter(Boolean).map(String))];
  const map = new Map();
  if (!ids.length) return map;

  try {
    const { body } = await client.search({
      index: INDICES.BRANCHES,
      body: {
        size: Math.min(ids.length, 10000),
        query: { ids: { values: ids } },
        _source: ['branch'],
      },
    });

    for (const hit of body.hits?.hits || []) {
      const name = hit._source?.branch != null ? String(hit._source.branch).trim() : '';
      if (name && !UUID_RE.test(name)) map.set(String(hit._id), name);
    }
  } catch (err) {
    if (err?.meta?.body?.error?.type !== 'index_not_found_exception') throw err;
  }

  return map;
}

/**
 * Device branch label for rollups:
 * 1) device.branch if valid
 * 2) else branch-index name for device.branchId (when device has id but blank name)
 */
export function resolveBranchName(device = {}, branchNamesById = new Map()) {
  const fromDevice = branchDisplayName(device);
  if (fromDevice) return fromDevice;

  const id = device.branchId != null ? String(device.branchId).trim() : '';
  if (!id) return null;
  const fromIndex = branchNamesById.get(id);
  return fromIndex || null;
}
