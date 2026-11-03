import axios from 'axios';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredSessionUser,
  isAuthenticated as isSessionAuthenticated,
  persistAuthSession,
} from '../utils/roleManagement';
import { resolveApiBaseUrl } from './config';

const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;

function toError(error, fallback) {
  const payload = error.response?.data || {};
  const err = new Error(payload.message || error.message || fallback);
  err.captchaRequired = Boolean(payload.captchaRequired);
  err.captchaProvider = payload.captchaProvider || '';
  err.captchaStep = payload.captchaStep || '';
  err.turnstileSiteKey = payload.turnstileSiteKey || '';
  return err;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || original._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Don't try refresh on auth endpoints themselves
    if (String(original.url || '').includes('/auth/')) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const accessToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export async function getCaptchaConfig() {
  try {
    const { data } = await api.get('/auth/captcha/config');
    if (!data.success) throw new Error(data.message || 'Failed to load CAPTCHA config');
    return data.data || {};
  } catch (error) {
    throw toError(error, 'Failed to load CAPTCHA config');
  }
}

export async function fetchLoginCaptcha() {
  try {
    const { data } = await api.get('/auth/captcha');
    if (!data.success) throw new Error(data.message || 'Failed to load CAPTCHA');
    return data.data || {};
  } catch (error) {
    throw toError(error, 'Failed to load CAPTCHA');
  }
}

export async function verifyLoginCaptcha(email, captcha = {}) {
  try {
    const { data } = await api.post('/auth/captcha/verify', { email, ...captcha });
    if (!data.success) throw new Error(data.message || 'CAPTCHA verification failed');
    return data.data || {};
  } catch (error) {
    throw toError(error, 'CAPTCHA verification failed');
  }
}

export async function login(email, password, captcha = {}) {
  try {
    const payload = { email, password, ...captcha };
    const { data } = await api.post('/auth/login', payload);
    if (!data.success) throw new Error(data.message || 'Login failed');

    const { user, accessToken, refreshToken } = data.data;
    persistAuthSession({ user, accessToken, refreshToken });
    return { user, accessToken, refreshToken };
  } catch (error) {
    throw toError(error, 'Network error. Please try again.');
  }
}

export async function logout() {
  const token = getAccessToken();
  try {
    if (token) {
      await api.post('/auth/logout', null, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Always clear local session even if API logout fails
  } finally {
    clearAuthSession();
  }
}

export function getCurrentUser() {
  return getStoredSessionUser();
}

export function isAuthenticated() {
  return isSessionAuthenticated();
}

export async function getProfile() {
  try {
    const { data } = await api.get('/auth/profile');
    if (!data.success) throw new Error(data.message || 'Failed to fetch profile');

    const user = data.data.user || data.data;
    persistAuthSession({ user });
    return user;
  } catch (error) {
    if (error.response?.status === 401) {
      clearAuthSession();
      window.location.href = '/login';
    }
    throw toError(error, 'Failed to fetch profile');
  }
}

export async function refreshAccessToken() {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token found');

    const { data } = await api.post('/auth/refresh', { refreshToken });
    if (!data.success) throw new Error('Token refresh failed');

    const { accessToken, refreshToken: nextRefresh } = data.data;
    persistAuthSession({
      accessToken,
      refreshToken: nextRefresh || refreshToken,
    });
    return accessToken;
  } catch (error) {
    clearAuthSession();
    window.location.href = '/login';
    throw toError(error, 'Token refresh failed');
  }
}
