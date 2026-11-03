import { v4 as uuidv4 } from 'uuid';
import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { listFirmwareFiles, resolveFirmwarePath } from '../config/scpConfig.js';
import { GROUP_ACT_TYPES } from '../config/groupConfigConfig.js';
import {
  getTemplateOrganizations,
  getTemplateModels,
  listTemplatesByOrgAndModel,
} from '../queries/templateQueries.js';
import {
  assertDevicesInScope,
  assertOrgAccess,
  createGroupConfig as insertGroupConfig,
  deleteGroupConfig as removeGroupConfig,
  getGroupConfig,
  getGroupConfigDetails,
  isConfigAction,
  isUpgradeAction,
  listActionsToRun,
  listGroupConfigs,
  listGroupDevices,
  refreshGroupConfig as syncGroupConfigStatus,
  requireConfigAccess,
  updateGroupAction,
  updateGroupConf,
  updateGroupConfig as saveGroupConfig,
} from '../queries/groupConfigQueries.js';
import { runTemplate, runUpgrade } from './mqttController.js';

function buildSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function actorUid(session) {
  return session.userId || session.email || '';
}

function groupConfigError(res, err, fallback) {
  const status = err.status || (/not found/i.test(err.message) ? 404 : 500);
  return error(res, err.message || fallback, status);
}

/** GET /api/v1/group-config */
export async function listGroupConfig(req, res) {
  try {
    const data = await listGroupConfigs(buildSession(req));
    return success(res, data, 'Group configs retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list group configs');
  }
}

/** GET /api/v1/group-config/organizations */
export async function listGroupConfigOrganizations(req, res) {
  try {
    const orgs = await getTemplateOrganizations(buildSession(req));
    return success(res, { orgs }, 'Group config organizations retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list organizations');
  }
}

/** GET /api/v1/group-config/models?orgId= */
export async function listGroupConfigModels(req, res) {
  try {
    const session = buildSession(req);
    const orgId = String(req.query?.orgId || '').trim();
    if (orgId) assertOrgAccess(session, orgId);
    const models = await getTemplateModels(orgId, session);
    return success(res, { models }, 'Group config models retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list models');
  }
}

/** GET /api/v1/group-config/templates?orgId=&model= */
export async function listGroupConfigTemplates(req, res) {
  try {
    const session = buildSession(req);
    const { orgId, model } = req.query;
    assertOrgAccess(session, orgId);
    const templates = await listTemplatesByOrgAndModel(orgId, model, session);
    return success(
      res,
      {
        templates: (templates || []).map((item) => ({
          name: item.temp_name || '',
          file: item.temp_file || '',
        })),
      },
      'Group config templates retrieved successfully'
    );
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list templates');
  }
}

/** GET /api/v1/group-config/firmwares?model= */
export async function listGroupConfigFirmwares(req, res) {
  try {
    const firmwares = await listFirmwareFiles(req.query.model);
    return success(res, { firmwares }, 'Group config firmwares retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list firmwares');
  }
}

/** GET /api/v1/group-config/devices?orgId=&model=&selectedIds= */
export async function listGroupConfigDevices(req, res) {
  try {
    const data = await listGroupDevices({
      orgId: req.query.orgId,
      model: req.query.model,
      selectedIds: req.query.selectedIds || [],
      session: buildSession(req),
    });
    return success(res, data, 'Group config devices retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to list devices');
  }
}

/** GET /api/v1/group-config/:id */
export async function getGroupConfigById(req, res) {
  try {
    const data = await getGroupConfig(req.params.id, buildSession(req));
    return success(res, data, 'Group config retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to fetch group config');
  }
}

/** POST /api/v1/group-config */
export async function createGroupConfig(req, res) {
  try {
    const session = buildSession(req);
    const { act_name, act_type, orgId, model, deviceIds } = req.body;
    assertOrgAccess(session, orgId);
    await assertDevicesInScope({ orgId, model, deviceIds, session });

    const payload = {
      act_name,
      act_type,
      orgId,
      model,
      t_name: '',
      f_name: '',
      keep: req.body.keep,
      force: req.body.force,
    };

    if (act_type === GROUP_ACT_TYPES.CONFIG) {
      payload.t_name = req.body.templateName;
      payload.f_name = req.body.templateFile;
    } else {
      payload.f_name = req.body.firmware;
      resolveFirmwarePath(model, payload.f_name);
    }

    const created = await insertGroupConfig({
      id: uuidv4(),
      uid: actorUid(session),
      payload,
      deviceIds,
    });
    return success(res, created, 'Group config created successfully', 201);
  } catch (err) {
    return groupConfigError(res, err, 'Failed to create group config');
  }
}

/** PUT /api/v1/group-config/:id */
export async function updateGroupConfig(req, res) {
  try {
    const session = buildSession(req);
    const existing = await getGroupConfig(req.params.id, session);
    await assertDevicesInScope({
      orgId: existing.config.orgId,
      model: existing.config.model,
      deviceIds: req.body.deviceIds,
      session,
    });
    const data = await saveGroupConfig(req.params.id, session, {
      act_name: req.body.act_name,
      deviceIds: req.body.deviceIds,
    });
    return success(res, { ok: data.ok }, 'Group config updated successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to update group config');
  }
}

/** DELETE /api/v1/group-config/:id */
export async function deleteGroupConfig(req, res) {
  try {
    const data = await removeGroupConfig(req.params.id, buildSession(req));
    return success(res, data, 'Group config deleted successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to delete group config');
  }
}

/** POST /api/v1/group-config/:id/run */
export async function runGroupConfig(req, res) {
  try {
    const session = buildSession(req);
    const actId = req.params.id;
    const conf = await requireConfigAccess(actId, session);
    const retryMode = Number(req.body?.new) === 1;

    const templateFile = String(conf.f_name || '').trim();
    if (!templateFile) {
      const err = new Error(isUpgradeAction(conf.act_type) ? 'Firmware file missing in config' : 'Template file missing in config');
      err.status = 400;
      throw err;
    }

    const devIds = await listActionsToRun(actId, { retryMode });
    if (!devIds.length) {
      return success(res, { ok: true, ran: 0 }, 'No devices to run');
    }

    let ran = 0;
    let failed = 0;

    for (const devId of devIds) {
      try {
        const result = isConfigAction(conf.act_type)
          ? await runTemplate(session, { devId, template: templateFile, type: 'group' })
          : await runUpgrade(session, {
              devId,
              firmware: templateFile,
              keep: conf.keep,
              force: conf.force,
              type: 'group',
            });

        await updateGroupAction(actId, devId, {
          task_id: result.reqId,
          process: null,
          result: null,
          status: null,
          msg: null,
        });
        ran += 1;
      } catch (err) {
        failed += 1;
        await updateGroupAction(actId, devId, {
          status: 1,
          msg: err.message || 'Failed to publish group action',
        });
      }
    }

    await updateGroupConf(actId, {
      act_status: 'Initiated',
      start_time: Math.floor(Date.now() / 1000),
    });

    return success(res, { ok: true, ran, failed }, 'Group config run started');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to run group config');
  }
}

/** POST /api/v1/group-config/:id/refresh */
export async function refreshGroupConfig(req, res) {
  try {
    const data = await syncGroupConfigStatus(req.params.id, buildSession(req));
    return success(res, data, 'Group config status refreshed successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to refresh group config');
  }
}

/** GET /api/v1/group-config/:id/details */
export async function getGroupConfigDetail(req, res) {
  try {
    const data = await getGroupConfigDetails(req.params.id, buildSession(req));
    return success(res, data, 'Group config details retrieved successfully');
  } catch (err) {
    return groupConfigError(res, err, 'Failed to fetch group config details');
  }
}
