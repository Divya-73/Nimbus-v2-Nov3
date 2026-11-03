import { api } from './auth';
import { getAccessToken } from '../utils/roleManagement';

function toError(error, fallback) {
  const body = error.response?.data;
  if (Array.isArray(body?.errors) && body.errors.length) {
    const detail = body.errors.map((item) => item.message || item.field).filter(Boolean).join('; ');
    if (detail) return new Error(detail);
  }
  return new Error(body?.message || error.message || fallback);
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
    if (Array.isArray(value)) {
      const joined = value.map((item) => String(item).trim()).filter(Boolean).join(',');
      if (joined) out[key] = joined;
      continue;
    }
    const str = String(value).trim();
    if (!str || str.toLowerCase() === 'all') continue;
    out[key] = str;
  }
  return out;
}

function unwrap(data, fallbackMessage) {
  if (!data?.success) throw new Error(data?.message || fallbackMessage);
  return data.data;
}

export async function fetchGroupConfigs() {
  requireAuth();
  try {
    const { data } = await api.get('/group-config');
    const payload = unwrap(data, 'Failed to fetch group configs');
    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      orgId: payload?.orgId || '',
    };
  } catch (error) {
    throw toError(error, 'Failed to fetch group configs');
  }
}

export async function fetchGroupConfigOrganizations() {
  requireAuth();
  try {
    const { data } = await api.get('/group-config/organizations');
    const payload = unwrap(data, 'Failed to fetch organizations');
    return payload?.orgs || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch organizations');
  }
}

export async function fetchGroupConfigModels(orgId) {
  requireAuth();
  try {
    const { data } = await api.get('/group-config/models', { params: cleanParams({ orgId }) });
    const payload = unwrap(data, 'Failed to fetch models');
    return payload?.models || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch models');
  }
}

export async function fetchGroupConfigTemplates(orgId, model) {
  requireAuth();
  try {
    const { data } = await api.get('/group-config/templates', {
      params: cleanParams({ orgId, model }),
    });
    const payload = unwrap(data, 'Failed to fetch templates');
    return payload?.templates || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch templates');
  }
}

export async function fetchGroupConfigFirmwares(model) {
  requireAuth();
  try {
    const { data } = await api.get('/group-config/firmwares', { params: cleanParams({ model }) });
    const payload = unwrap(data, 'Failed to fetch firmwares');
    return payload?.firmwares || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch firmwares');
  }
}

export async function fetchGroupConfigDevices({ orgId, model, selectedIds = [] } = {}) {
  requireAuth();
  try {
    const { data } = await api.get('/group-config/devices', {
      params: cleanParams({ orgId, model, selectedIds }),
    });
    const payload = unwrap(data, 'Failed to fetch devices');
    return payload?.devices || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch devices');
  }
}

export async function fetchGroupConfigById(id) {
  requireAuth();
  try {
    const { data } = await api.get(`/group-config/${encodeURIComponent(id)}`);
    return unwrap(data, 'Failed to fetch group config');
  } catch (error) {
    throw toError(error, 'Failed to fetch group config');
  }
}

export async function createGroupConfig(payload) {
  requireAuth();
  try {
    const { data } = await api.post('/group-config', payload);
    return unwrap(data, 'Failed to create group config');
  } catch (error) {
    throw toError(error, 'Failed to create group config');
  }
}

export async function updateGroupConfig(id, payload) {
  requireAuth();
  try {
    const { data } = await api.put(`/group-config/${encodeURIComponent(id)}`, payload);
    return unwrap(data, 'Failed to update group config');
  } catch (error) {
    throw toError(error, 'Failed to update group config');
  }
}

export async function deleteGroupConfig(id) {
  requireAuth();
  try {
    const { data } = await api.delete(`/group-config/${encodeURIComponent(id)}`);
    return unwrap(data, 'Failed to delete group config');
  } catch (error) {
    throw toError(error, 'Failed to delete group config');
  }
}

export async function runGroupConfig(id, { retry = false } = {}) {
  requireAuth();
  try {
    const { data } = await api.post(`/group-config/${encodeURIComponent(id)}/run`, {
      new: retry ? 1 : 0,
    });
    return unwrap(data, 'Failed to run group config');
  } catch (error) {
    throw toError(error, 'Failed to run group config');
  }
}

export async function refreshGroupConfig(id) {
  requireAuth();
  try {
    const { data } = await api.post(`/group-config/${encodeURIComponent(id)}/refresh`);
    return unwrap(data, 'Failed to refresh group config');
  } catch (error) {
    throw toError(error, 'Failed to refresh group config');
  }
}

export async function fetchGroupConfigDetails(id) {
  requireAuth();
  try {
    const { data } = await api.get(`/group-config/${encodeURIComponent(id)}/details`);
    const payload = unwrap(data, 'Failed to fetch group config details');
    return payload?.items || [];
  } catch (error) {
    throw toError(error, 'Failed to fetch group config details');
  }
}
