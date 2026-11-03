import { v4 as uuidv4 } from 'uuid';
import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import { runTemplate } from './mqttController.js';
import {
  createTemplateProvisionJob,
  markProvisionAction,
  markProvisionStarted,
  previewTemplateProvision,
} from '../queries/templateProvisionQueries.js';

function buildSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    role: String(req.user?.role || scope.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || '').trim(),
    email: String(req.user?.email || '').trim(),
  };
}

function actorUid(session) {
  return session.userId || session.email || '';
}

function failStatus(err) {
  if (err.status) return err.status;
  if (/not found/i.test(err.message || '')) return 404;
  return 500;
}

/** POST /api/v1/performance/template-provision/preview */
export async function previewPerformanceTemplateProvision(req, res) {
  try {
    const data = await previewTemplateProvision(req.body?.deviceIds, buildSession(req));
    return success(res, data, 'Template provision preview ready');
  } catch (err) {
    return error(res, err.message || 'Failed to preview template provision', failStatus(err));
  }
}

/** POST /api/v1/performance/template-provision */
export async function runPerformanceTemplateProvision(req, res) {
  try {
    const session = buildSession(req);
    const uid = actorUid(session);
    if (!uid) {
      const err = new Error('Authenticated user context missing');
      err.status = 401;
      throw err;
    }

    const job = await createTemplateProvisionJob({
      deviceIds: req.body?.deviceIds,
      templateId: req.body?.templateId,
      actName: req.body?.act_name,
      session,
      uid,
      actId: uuidv4(),
    });

    const results = [];
    let ran = 0;
    let failed = 0;

    for (const device of job.devices) {
      if (!device.up) {
        failed += 1;
        await markProvisionAction(job.actId, device.id, {
          status: 1,
          msg: 'Device is not UP. MQTT template push was skipped.',
        });
        results.push({
          id: device.id,
          hostname: device.hostname,
          ok: false,
          message: 'Device is not UP',
        });
        continue;
      }

      try {
        const result = await runTemplate(session, {
          devId: device.id,
          template: job.template.file,
          type: 'group',
        });
        await markProvisionAction(job.actId, device.id, {
          task_id: result.reqId,
          process: null,
          result: null,
          status: null,
          msg: null,
        });
        ran += 1;
        results.push({
          id: device.id,
          hostname: device.hostname,
          ok: true,
          reqId: result.reqId,
        });
      } catch (err) {
        failed += 1;
        const message = err.message || 'Failed to publish template';
        await markProvisionAction(job.actId, device.id, {
          status: 1,
          msg: message,
        });
        results.push({
          id: device.id,
          hostname: device.hostname,
          ok: false,
          message,
        });
      }
    }

    await markProvisionStarted(job.actId);

    return success(
      res,
      {
        actId: job.actId,
        actName: job.actName,
        templateName: job.template.name,
        templateFile: job.template.file,
        orgId: job.orgId,
        model: job.model,
        ran,
        failed,
        results,
      },
      ran ? 'Template provision started' : 'No devices received the template',
    );
  } catch (err) {
    return error(res, err.message || 'Failed to provision template', failStatus(err));
  }
}
