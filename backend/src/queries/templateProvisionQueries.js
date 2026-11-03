import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';
import {
  buildSessionFilters,
  DEVICE_STATUS,
  getActivityCutoff,
  getDeviceStatus,
  isAssigned,
} from '../config/deviceStatusConfig.js';
import { GROUP_ACT_TYPES } from '../config/groupConfigConfig.js';
import { loadTemplateFile } from '../utils/templateUtils.js';
import { fetchOrgNamesByIds, resolveOrgName } from './orgNameLookup.js';
import { fetchBranchNamesByIds, resolveBranchName } from './branchNameLookup.js';
import { getTemplateById, listTemplatesByOrgAndModel } from './templateQueries.js';
import {
  assertDevicesInScope,
  createGroupConfig,
  updateGroupAction,
  updateGroupConf,
} from './groupConfigQueries.js';

const MAX_DEVICES = 100;
const DEVICE_SOURCE = [
  'sysname',
  'model',
  'orgId',
  'org',
  'branchId',
  'branch',
  'slu',
  'lastupdated',
];

function statusError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isIndexMissing(err) {
  return err?.meta?.body?.error?.type === 'index_not_found_exception';
}

export function asDeviceIdList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (value == null || value === '') return [];
  return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
}

export function assertCanProvision(session = {}) {
  if (session.isSuperAdmin || session.isOrgAdmin || session.isBranchAdmin) return;
  const role = String(session.role || '').trim();
  if (role === '7' || role === '1' || role === '99') return;
  throw statusError('You do not have permission to provision templates', 403);
}

function uniqueLabels(values) {
  return [...new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))];
}

async function loadSelectedDevices(deviceIds, session = {}) {
  const ids = asDeviceIdList(deviceIds);
  if (!ids.length) throw statusError('Select at least one device', 400);
  if (ids.length > MAX_DEVICES) {
    throw statusError(`Select at most ${MAX_DEVICES} devices`, 400);
  }

  let hits = [];
  try {
    const { body } = await client.search({
      index: INDICES.DEVICES,
      body: {
        size: ids.length,
        query: {
          bool: {
            filter: [...buildSessionFilters(session), { ids: { values: ids } }],
          },
        },
        _source: DEVICE_SOURCE,
      },
    });
    hits = (body?.hits?.hits || []).filter((hit) => isAssigned(hit._source || {}));
  } catch (err) {
    if (isIndexMissing(err)) throw statusError('One or more devices are invalid or out of scope', 400);
    throw err;
  }

  if (hits.length !== ids.length) {
    throw statusError('One or more devices are invalid or out of scope', 400);
  }

  const cutoff = getActivityCutoff();
  const orgIds = uniqueLabels(hits.map((hit) => hit._source?.orgId));
  const branchIds = uniqueLabels(hits.map((hit) => hit._source?.branchId));
  const [orgNamesById, branchNamesById] = await Promise.all([
    fetchOrgNamesByIds(orgIds),
    fetchBranchNamesByIds(branchIds),
  ]);

  const byId = new Map(
    hits.map((hit) => {
      const src = hit._source || {};
      const status = getDeviceStatus(src, cutoff);
      return [
        String(hit._id),
        {
          id: hit._id,
          hostname: src.sysname || 'Unknown',
          model: String(src.model || '').trim(),
          orgId: String(src.orgId || '').trim(),
          org: resolveOrgName(src, orgNamesById) || src.org || '',
          branchId: String(src.branchId || '').trim(),
          branch: resolveBranchName(src, branchNamesById) || src.branch || '',
          status,
          up: status === DEVICE_STATUS.UP,
        },
      ];
    }),
  );

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function assertSameOrgAndModel(devices = []) {
  const orgIds = uniqueLabels(devices.map((device) => device.orgId));
  const models = uniqueLabels(devices.map((device) => device.model));

  if (orgIds.length !== 1) {
    throw statusError('Select devices from the same organization. Templates are organization-specific.', 400);
  }
  if (models.length !== 1) {
    throw statusError('Select devices of the same model. Templates are model-specific.', 400);
  }

  return { orgId: orgIds[0], model: models[0] };
}

function mapTemplateOption(item) {
  return {
    id: item.id,
    name: item.temp_name || '',
    file: item.temp_file || '',
    type: item.temp_type || '',
    desc: item.desc || '',
  };
}

/**
 * Preview templates that can be pushed to the selected Device Performance CPEs.
 * Devices must be assigned and share one org + one model.
 */
export async function previewTemplateProvision(deviceIds, session = {}) {
  assertCanProvision(session);
  const devices = await loadSelectedDevices(deviceIds, session);
  const { orgId, model } = assertSameOrgAndModel(devices);
  const templates = (await listTemplatesByOrgAndModel(orgId, model, session)).map(mapTemplateOption);

  return {
    orgId,
    org: devices[0]?.org || '',
    model,
    devices,
    templates,
    upCount: devices.filter((device) => device.up).length,
    downCount: devices.filter((device) => !device.up).length,
  };
}

async function resolveProvisionJob({ deviceIds, templateId, actName, session = {} }) {
  assertCanProvision(session);

  const preview = await previewTemplateProvision(deviceIds, session);
  const template = await getTemplateById(templateId, session);
  const file = String(template.temp_file || '').trim();
  if (!file) throw statusError('Template file is missing', 400);

  const templateOrg = String(template.orgId || '').trim();
  const templateModel = String(template.model || '').trim();
  if (templateOrg && templateOrg !== preview.orgId) {
    throw statusError('Template does not belong to this organization', 400);
  }
  if (templateModel && templateModel !== preview.model) {
    throw statusError('Template model does not match the selected devices', 400);
  }

  try {
    await loadTemplateFile(file);
  } catch (err) {
    if (err?.status === 400) throw err;
    throw statusError(`${file} not found`, 404);
  }

  const name = String(actName || '').trim()
    || `Provision ${template.temp_name || file}`.slice(0, 80);

  await assertDevicesInScope({
    orgId: preview.orgId,
    model: preview.model,
    deviceIds: preview.devices.map((device) => device.id),
    session,
  });

  return {
    ...preview,
    template: {
      id: template.id,
      name: template.temp_name || '',
      file,
      type: template.temp_type || '',
    },
    actName: name,
  };
}

export async function createTemplateProvisionJob({
  deviceIds,
  templateId,
  actName,
  session = {},
  uid = '',
  actId,
}) {
  const job = await resolveProvisionJob({ deviceIds, templateId, actName, session });
  const created = await createGroupConfig({
    id: actId,
    uid,
    payload: {
      act_name: job.actName,
      act_type: GROUP_ACT_TYPES.CONFIG,
      orgId: job.orgId,
      model: job.model,
      t_name: job.template.name,
      f_name: job.template.file,
    },
    deviceIds: job.devices.map((device) => device.id),
  });

  return { ...job, actId: created.id };
}

export async function markProvisionAction(actId, deviceId, doc) {
  await updateGroupAction(actId, deviceId, doc);
}

export async function markProvisionStarted(actId) {
  await updateGroupConf(actId, {
    act_status: 'Initiated',
    start_time: Math.floor(Date.now() / 1000),
  });
}
