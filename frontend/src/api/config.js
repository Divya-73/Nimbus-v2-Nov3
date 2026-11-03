/**
 * Resolve API base URL at runtime so the same build works on
 * private IP (172.16.0.62) and public IP (122.160.82.93).
 * Same hostname as the page, backend on VITE_API_PORT (default 3005).
 * Localhost keeps VITE_API_URL for local Vite → local API.
 */
export function resolveApiBaseUrl() {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim();
  const fallback = envUrl || 'https://localhost:5001/api/v1';

  if (typeof window === 'undefined' || !window.location?.hostname) {
    return fallback.replace(/\/$/, '');
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return fallback.replace(/\/$/, '');
  }

  const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:';
  const pagePort = String(window.location.port || '').trim();
  // Standard HTTPS (443) — API via same host /api (nginx reverse proxy)
  if (protocol === 'https:' && (pagePort === '' || pagePort === '443')) {
    return `${protocol}//${host}/api/v1`;
  }

  const apiPort = String(import.meta.env.VITE_API_PORT || '3005').trim() || '3005';
  return `${protocol}//${host}:${apiPort}/api/v1`;
}

export function resolveApiOrigin() {
  try {
    return new URL(resolveApiBaseUrl()).origin;
  } catch {
    return 'https://localhost:5001';
  }
}
