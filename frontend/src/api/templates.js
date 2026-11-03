import { api } from './auth';
import { getAccessToken } from '../utils/roleManagement';

function toError(error, fallback) {
  return new Error(error.response?.data?.message || error.message || fallback);
}

function requireAuth() {
  if (!getAccessToken()) {
    window.location.href = '/login';
    throw new Error('No access token found');
  }
}

function cleanParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const str = String(value).trim();
    if (!str || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

export async function fetchTemplateTypes() {
  requireAuth();
  try {
    const { data } = await api.get('/templates/types');
    if (!data.success) throw new Error(data.message || 'Failed to fetch template types');
    return data.data || { name: 'Template Config', options: [] };
  } catch (error) {
    throw toError(error, 'Failed to fetch template types');
  }
}

export async function fetchTemplateOrganizations() {
  requireAuth();
  try {
    const { data } = await api.get('/templates/organizations');
    if (!data.success) throw new Error(data.message || 'Failed to fetch organizations');
    return data.data || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch organizations');
  }
}

export async function fetchTemplateModels(orgId) {
  requireAuth();
  try {
    const { data } = await api.get('/templates/models', { params: cleanParams({ orgId }) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch models');
    return data.data || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch models');
  }
}

export async function fetchTemplates(params = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/templates', { params: cleanParams(params) });
    if (!data.success) throw new Error(data.message || 'Failed to fetch templates');
    return data.data || { templates: [], total: 0, page: 1, pageSize: 10 };
  } catch (error) {
    throw toError(error, 'Failed to fetch templates');
  }
}

export async function fetchTemplateById(id) {
  requireAuth();
  try {
    const { data } = await api.get(`/templates/${encodeURIComponent(id)}`);
    if (!data.success) throw new Error(data.message || 'Failed to fetch template');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to fetch template');
  }
}

export async function createTemplate(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/templates', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create template');
    return data;
  } catch (error) {
    throw toError(error, 'Failed to create template');
  }
}

export async function updateTemplate(id, payload) {
  requireAuth();
  try {
    const { data } = await api.put(`/templates/${encodeURIComponent(id)}`, payload);
    if (!data.success) throw new Error(data.message || 'Failed to update template');
    return data;
  } catch (error) {
    throw toError(error, 'Failed to update template');
  }
}

export async function deleteTemplate(id) {
  requireAuth();
  try {
    const { data } = await api.delete(`/templates/${encodeURIComponent(id)}`);
    if (!data.success) throw new Error(data.message || 'Failed to delete template');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to delete template');
  }
}

export async function createMasterTemplate(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/templates/master', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create master template');
    return data.data;
  } catch (error) {
    throw toError(error, 'Failed to create master template');
  }
}
