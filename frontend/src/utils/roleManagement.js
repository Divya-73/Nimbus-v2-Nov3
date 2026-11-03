const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const PROFILE_KEY = 'profile';

/** Matches backend USER_ROLES in databaseConfig.js */
export const ROLES = {
  SUPER_ADMIN: '99',
  ORG_ADMIN: '7',
  BRANCH_ADMIN: '1',
  VIEWER: '11',
};

const ROLE_ALIASES = {
  '99': ROLES.SUPER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
  '7': ROLES.ORG_ADMIN,
  org_admin: ROLES.ORG_ADMIN,
  admin: ROLES.ORG_ADMIN,
  '1': ROLES.BRANCH_ADMIN,
  branch_admin: ROLES.BRANCH_ADMIN,
  user: ROLES.BRANCH_ADMIN,
  '11': ROLES.VIEWER,
  viewer: ROLES.VIEWER,
};

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ORG_ADMIN]: 'Org Admin',
  [ROLES.BRANCH_ADMIN]: 'Branch Admin',
  [ROLES.VIEWER]: 'Viewer',
};

export function persistAuthSession({ user, accessToken, refreshToken } = {}) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredSessionUser() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function normalizeRole(role) {
  if (role == null || role === '') return '';
  const key = String(role).trim().toLowerCase();
  return ROLE_ALIASES[key] || String(role).trim();
}

export function getUserRole(user = getStoredSessionUser()) {
  return normalizeRole(user?.role);
}

export function getRoleLabel(role = getUserRole()) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || (normalized ? `Role ${normalized}` : 'Unknown');
}

export function hasRole(userOrRole, ...allowedRoles) {
  const role =
    typeof userOrRole === 'object' && userOrRole !== null
      ? getUserRole(userOrRole)
      : normalizeRole(userOrRole);

  if (!role || allowedRoles.length === 0) return false;
  const allowed = allowedRoles.map(normalizeRole);
  return allowed.includes(role);
}

export function canAccessConsole(user = getStoredSessionUser()) {
  const role = getUserRole(user);
  return [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.BRANCH_ADMIN, ROLES.VIEWER].includes(role);
}
