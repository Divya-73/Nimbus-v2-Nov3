import { getValidTemplateTypeValues } from '../config/templateConfig.js';

const VALID_TYPES = getValidTemplateTypeValues();
const CONTENT_ARRAY_FIELDS = ['stop', 'start', 'restart', 'trunc'];

export function validateTemplateName(name) {
  const str = String(name ?? '').trim();
  if (!str) return 'Template name is required';
  if (str.length > 128) return 'Template name must be 128 characters or less';
  if (!/^[a-zA-Z0-9._-]+$/.test(str)) {
    return 'Template name may only contain letters, numbers, dots, underscores, and hyphens';
  }
  return null;
}

function parseTemplateContent(content) {
  if (content == null) return { parsed: null, error: 'Template content is required' };
  if (typeof content === 'object') return { parsed: content, error: null };

  if (typeof content === 'string') {
    try {
      return { parsed: JSON.parse(content), error: null };
    } catch {
      return { parsed: null, error: 'Content must be valid JSON' };
    }
  }

  return { parsed: null, error: 'Content must be an object' };
}

function validateContentStructure(parsedContent, { requireOpts = true } = {}) {
  const errors = [];
  if (!parsedContent || typeof parsedContent !== 'object' || Array.isArray(parsedContent)) {
    errors.push({ field: 'content', message: 'Content must be an object' });
    return errors;
  }

  if (requireOpts) {
    if (!parsedContent.opts || !Array.isArray(parsedContent.opts)) {
      errors.push({ field: 'content.opts', message: 'Content must include "opts" array' });
    }
  } else if (parsedContent.opts != null && !Array.isArray(parsedContent.opts)) {
    errors.push({ field: 'content.opts', message: 'opts must be an array' });
  }

  for (const field of CONTENT_ARRAY_FIELDS) {
    if (parsedContent[field] != null && !Array.isArray(parsedContent[field])) {
      errors.push({ field: `content.${field}`, message: `${field} must be an array` });
    }
  }

  return errors;
}

export function validateCreateTemplateInput(body = {}, session = {}) {
  const errors = [];
  const { temp_name, temp_type, orgId, model, content } = body;

  if (!temp_name) {
    errors.push({ field: 'temp_name', message: 'Template name is required' });
  } else {
    const nameError = validateTemplateName(temp_name);
    if (nameError) errors.push({ field: 'temp_name', message: nameError });
  }

  if (!temp_type) {
    errors.push({ field: 'temp_type', message: 'Template type is required' });
  } else if (!VALID_TYPES.includes(String(temp_type).trim())) {
    errors.push({
      field: 'temp_type',
      message: `Invalid template type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  if (session.isSuperAdmin && !orgId) {
    errors.push({ field: 'orgId', message: 'Organization ID is required' });
  }

  if (!model) {
    errors.push({ field: 'model', message: 'Model is required' });
  }

  if (content == null || content === '') {
    errors.push({ field: 'content', message: 'Template content is required' });
  } else {
    const { parsed, error } = parseTemplateContent(content);
    if (error) {
      errors.push({ field: 'content', message: error });
    } else {
      errors.push(...validateContentStructure(parsed, { requireOpts: true }));
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function validateUpdateTemplateInput(body = {}) {
  const errors = [];
  const { temp_name, temp_type, content, desc, model, formValue } = body;

  if (
    temp_name === undefined &&
    temp_type === undefined &&
    content === undefined &&
    desc === undefined &&
    model === undefined &&
    formValue === undefined
  ) {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'At least one field must be provided for update' }],
    };
  }

  if (temp_name !== undefined) {
    const nameError = validateTemplateName(temp_name);
    if (nameError) errors.push({ field: 'temp_name', message: nameError });
  }

  if (temp_type !== undefined) {
    const type = String(temp_type).trim();
    if (!VALID_TYPES.includes(type)) {
      errors.push({
        field: 'temp_type',
        message: `Invalid template type. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }
  }

  if (content !== undefined) {
    const { parsed, error } = parseTemplateContent(content);
    if (error) {
      errors.push({ field: 'content', message: error });
    } else {
      errors.push(...validateContentStructure(parsed, { requireOpts: false }));
    }
  }

  if (model !== undefined && !String(model).trim()) {
    errors.push({ field: 'model', message: 'Model cannot be empty' });
  }

  if (desc !== undefined && typeof desc !== 'string') {
    errors.push({ field: 'desc', message: 'Description must be a string' });
  }

  if (formValue !== undefined && (formValue === null || typeof formValue !== 'object' || Array.isArray(formValue))) {
    errors.push({ field: 'formValue', message: 'formValue must be an object' });
  }

  return { isValid: errors.length === 0, errors };
}

export function validateMasterTemplateInput(body = {}, session = {}) {
  const errors = [];
  const { temp_name, orgId, model, templateIds } = body;

  if (!temp_name) {
    errors.push({ field: 'temp_name', message: 'Master template name is required' });
  } else {
    const nameError = validateTemplateName(temp_name);
    if (nameError) errors.push({ field: 'temp_name', message: nameError });
  }

  if (session.isSuperAdmin && !orgId) {
    errors.push({ field: 'orgId', message: 'Organization ID is required' });
  }

  if (!model) {
    errors.push({ field: 'model', message: 'Model is required' });
  }

  if (!templateIds) {
    errors.push({ field: 'templateIds', message: 'Template IDs are required' });
  } else if (!Array.isArray(templateIds)) {
    errors.push({ field: 'templateIds', message: 'Template IDs must be an array' });
  } else if (templateIds.length < 2) {
    errors.push({
      field: 'templateIds',
      message: 'At least 2 templates are required to create master template',
    });
  } else {
    const invalidIds = templateIds.filter((id) => !id || typeof id !== 'string' || !String(id).trim());
    if (invalidIds.length) {
      errors.push({ field: 'templateIds', message: 'All template IDs must be non-empty strings' });
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function validateTemplateIdParam(id) {
  if (!id || typeof id !== 'string' || !id.trim()) {
    return { isValid: false, errors: [{ field: 'id', message: 'Invalid template ID' }] };
  }
  return { isValid: true, errors: [] };
}
