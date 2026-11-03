import { v4 as uuidv4 } from 'uuid';
import { success, error } from '../utils/response.js';
import { sessionFromReq } from '../utils/sessionScope.js';
import {
  getTemplateOrganizations as listTemplateOrganizations,
  getTemplateModels as listTemplateModels,
  listTemplates,
  listTemplatesByOrgAndModel,
  getTemplateById as fetchTemplateById,
  createTemplate as insertTemplate,
  updateTemplateById,
  deleteTemplateById,
  assertCanManageTemplates,
} from '../queries/templateQueries.js';
import { TEMPLATE_TYPES, TEMPLATE_TYPE_NAME } from '../config/templateConfig.js';
import {
  saveTemplateFile,
  loadTemplateFile,
  deleteTemplateFile,
  combineMasterTemplate,
  buildTemplateFilename,
} from '../utils/templateUtils.js';

function buildTemplateSession(req) {
  const scope = req.scope || {};
  return {
    ...sessionFromReq(req),
    isSuperAdmin: Boolean(scope.isSuperAdmin),
    isOrgAdmin: Boolean(scope.isOrgAdmin),
    isBranchAdmin: Boolean(scope.isBranchAdmin),
    role: String(scope.role || req.user?.role || '').trim(),
    userId: String(req.user?.userId || req.user?.id || req.user?._id || '').trim(),
  };
}

function collectTemplateFilters(req) {
  const q = req.query || {};
  const filters = {};
  for (const key of ['orgId', 'model', 'type', 'search', 'sortBy', 'sortOrder']) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      filters[key] = String(q[key]).trim();
    }
  }
  return filters;
}

async function rollbackCreatedFile(tempFile) {
  try {
    await deleteTemplateFile(tempFile);
  } catch {}
}

  /**
   * GET /api/v1/templates/organizations
   * Returns organizations based on user role:
   * - Super Admin (99): sees all organizations
   * - Other users: see only their organization
   */
  export async function getTemplateOrganizations(req, res) {
  try {
    const session = buildTemplateSession(req);
    const data = await listTemplateOrganizations(session);
    return success(res, data, 'Template organizations retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch template organizations', err.status || 500);
  }
}
  
  /**
   * GET /api/v1/templates/models?orgId=xxx
   */
  export async function getTemplateModels(req, res) {
  try {
    const session = buildTemplateSession(req);
    const { orgId } = req.query;
    const data = await listTemplateModels(orgId, session);
    return success(res, data, 'Template models retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch template models', err.status || 500);
  }
}
  
  /**
   * GET /api/v1/templates
   * Returns templates based on user role:
   * - Super Admin (99): can see templates from any organization (if orgId not specified)
   * - Other users: can only see templates from their organization
   */
  export async function getTemplates(req, res) {
  try {
    const session = buildTemplateSession(req);
    const filters = collectTemplateFilters(req);
    if (!session.isSuperAdmin) delete filters.orgId;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);
    const data = await listTemplates({ ...filters, page, pageSize }, session);
    return success(res, data, 'Templates retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch templates', err.status || 500);
  }
}
  
  /**
   * GET /api/v1/templates/types
   */
  export async function getTemplateTypes(req, res) {
  try {
    return success(
      res,
      { name: TEMPLATE_TYPE_NAME, options: TEMPLATE_TYPES },
      'Template types retrieved successfully'
    );
  } catch (err) {
    return error(res, err.message || 'Failed to fetch template types', err.status || 500);
  }
}
  
  /**
   * GET /api/v1/templates/org/:orgId/model/:model
   */
  export async function getTemplatesByOrg(req, res) {
  try {
    const session = buildTemplateSession(req);
    const { orgId, model } = req.params;
    const data = await listTemplatesByOrgAndModel(orgId, model, session);
    return success(res, data, 'Templates retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch templates', err.status || 500);
  }
}
  
  /**
   * GET /api/v1/templates/:id
   */
  export async function getTemplateById(req, res) {
  try {
    const session = buildTemplateSession(req);
    const { id } = req.params;
    const data = await fetchTemplateById(id, session);

    if (data.temp_file) {
      try {
        data.content = await loadTemplateFile(data.temp_file);
      } catch {
        // Metadata is still useful when the backing file is missing.
      }
    }

    return success(res, data, 'Template retrieved successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to fetch template', err.status || 500);
  }
}
  
  /**
   * POST /api/v1/templates
   */
  export async function createTemplate(req, res) {
  try {
    const session = buildTemplateSession(req);
    assertCanManageTemplates(session);
    const { content, formValue, ...input } = req.body || {};
    const id = String(input.id || '').trim() || uuidv4();
    const effectiveOrgId = session.isSuperAdmin ? input.orgId : session.orgId;
    const temp_file = buildTemplateFilename(input.temp_name, {
      id,
      orgId: effectiveOrgId,
      model: input.model,
    });

    await saveTemplateFile(temp_file, content, formValue);

    let data;
    try {
      data = await insertTemplate(
        {
          id,
          ...input,
          temp_file,
        },
        session
      );
    } catch (err) {
      await rollbackCreatedFile(temp_file);
      throw err;
    }

    return success(res, data, 'Template created successfully', 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create template', err.status || 500);
  }
}
  
  /**
   * PUT /api/v1/templates/:id
   */
  export async function updateTemplate(req, res) {
  try {
    const session = buildTemplateSession(req);
    assertCanManageTemplates(session);
    const { id } = req.params;
    const { content, formValue, ...updateData } = req.body || {};

    const existing = await fetchTemplateById(id, session);
    const temp_file = updateData.temp_file || existing.temp_file;
    let previousContent = null;

    if (content !== undefined) {
      if (!temp_file) {
        return error(res, 'temp_file is required to save content', 400);
      }
      try {
        previousContent = await loadTemplateFile(temp_file);
      } catch {}
      await saveTemplateFile(temp_file, content, formValue);
    } else if (formValue !== undefined) {
      if (!temp_file) {
        return error(res, 'temp_file is required to save formValue', 400);
      }
      previousContent = await loadTemplateFile(temp_file);
      await saveTemplateFile(temp_file, previousContent, formValue);
    }

    const dbUpdateData = { ...updateData, temp_file };
    for (const key of Object.keys(dbUpdateData)) {
      if (dbUpdateData[key] === undefined) delete dbUpdateData[key];
    }

    let data;
    try {
      data = await updateTemplateById(id, dbUpdateData, session);
    } catch (err) {
      if (previousContent) {
        try {
          await saveTemplateFile(temp_file, previousContent, previousContent.formValue);
        } catch {}
      }
      throw err;
    }

    return success(res, data, 'Template updated successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to update template', err.status || 500);
  }
}
  
  /**
   * DELETE /api/v1/templates/:id
   */
  export async function deleteTemplate(req, res) {
  try {
    const session = buildTemplateSession(req);
    assertCanManageTemplates(session);
    const { id } = req.params;
    const template = await fetchTemplateById(id, session);

    if (template.temp_file) {
      await deleteTemplateFile(template.temp_file);
    }

    const data = await deleteTemplateById(id, session);
    return success(res, data, 'Template deleted successfully');
  } catch (err) {
    return error(res, err.message || 'Failed to delete template', err.status || 500);
  }
}
  
  /**
   * POST /api/v1/templates/master
   */
  export async function createMasterTemplate(req, res) {
  try {
    const session = buildTemplateSession(req);
    assertCanManageTemplates(session);
    const { temp_name, orgId, model, templateIds, desc } = req.body || {};

    const templates = await Promise.all(
      templateIds.map((templateId) => fetchTemplateById(templateId, session))
    );

    for (const template of templates) {
      if (template.is_master) {
        return error(res, `Template "${template.temp_name}" is already a master template`, 400);
      }
      if (String(template.model || '').trim() !== String(model || '').trim()) {
        return error(res, `Template "${template.temp_name}" belongs to a different model`, 400);
      }
      if (String(template.orgId || '').trim() !== String((session.isSuperAdmin ? orgId : session.orgId) || '').trim()) {
        return error(res, `Template "${template.temp_name}" belongs to a different organization`, 400);
      }
    }

    const masterContent = await combineMasterTemplate(templates);
    const id = uuidv4();
    const effectiveOrgId = session.isSuperAdmin ? orgId : session.orgId;
    const temp_file = buildTemplateFilename(temp_name, {
      master: true,
      id,
      orgId: effectiveOrgId,
      model,
    });
    await saveTemplateFile(temp_file, masterContent);

    let data;
    try {
      data = await insertTemplate(
        {
          id,
          temp_name,
          orgId,
          model,
          temp_type: 'system',
          desc: desc || '',
          temp_file,
          is_master: true,
          parent_templates: templateIds,
        },
        session
      );
    } catch (err) {
      await rollbackCreatedFile(temp_file);
      throw err;
    }

    return success(res, data, 'Master template created successfully', 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create master template', err.status || 500);
  }
}