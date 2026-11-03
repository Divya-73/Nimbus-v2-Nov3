import helmet from 'helmet';

/** Paths that proxy device LuCI HTML (must allow framing from the web UI origin). */
export function isGuiProxyPath(pathname = '') {
  const p = String(pathname || '');
  return p.includes('/devices/gui-proxy/') || p.startsWith('/cgi-bin/') || p.startsWith('/luci-static/');
}

/** Helmet for JSON API routes — strict framing (clickjacking protection). */
export function createApiHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
  });
}

/** Allowed parent origins for device GUI iframe (frontend :5005). */
export function guiFrameAncestorOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaults = [
    'https://nmscloud.systrome.com:5005',
    'https://122.160.82.93:5005',
    'https://172.16.0.62:5005',
  ];
  return [...new Set([...fromEnv, ...defaults])];
}

export function guiProxySecurityHeaders() {
  const ancestors = guiFrameAncestorOrigins().join(' ');
  return {
    'Content-Security-Policy': `frame-ancestors ${ancestors}`,
  };
}

export function applyGuiProxyFrameHeaders(res) {
  const headers = guiProxySecurityHeaders();
  res.setHeader('Content-Security-Policy', headers['Content-Security-Policy']);
  res.removeHeader('X-Frame-Options');
}
