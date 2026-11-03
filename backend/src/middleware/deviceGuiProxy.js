import http from 'http';
import https from 'https';
import { verifyGuiAccessToken, guiSessionTtlSeconds } from '../utils/guiSession.js';
import { guiProxySecurityHeaders } from './securityHeaders.js';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const GUI_TOKEN_COOKIE = 'nimbus_gui_token';

function isIpv6(ip) {
  return String(ip).includes(':') && !String(ip).includes('.');
}

function formatHostHeader(ip) {
  return isIpv6(ip) ? `[${ip}]` : String(ip);
}

export function proxyBasePath(token) {
  return `/api/v1/devices/gui-proxy/${encodeURIComponent(token)}/`;
}

export function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

/**
 * When LuCI navigates to /cgi-bin/... or /luci-static/... (outside the proxy
 * prefix), bounce back under the GUI proxy using the session cookie.
 */
export function rescueGuiRootPaths(req, res, next) {
  const p = req.path || '';
  const needsRescue =
    p.startsWith('/cgi-bin/') ||
    p.startsWith('/luci-static/') ||
    p === '/ubus' ||
    p.startsWith('/ubus/') ||
    p.startsWith('/luci-mobile');

  if (!needsRescue) return next();

  const token = readCookie(req, GUI_TOKEN_COOKIE);
  if (!token) return next();

  try {
    verifyGuiAccessToken(token);
  } catch {
    return next();
  }

  const dest = `${proxyBasePath(token)}${p.replace(/^\//, '')}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return res.redirect(307, dest);
}

function rewriteLocation(value, token, guiIp) {
  if (!value) return value;
  const base = proxyBasePath(token);
  try {
    const u = new URL(value, `https://${formatHostHeader(guiIp)}/`);
    const hostOnly = formatHostHeader(guiIp).replace(/^\[|\]$/g, '');
    if (u.hostname === guiIp || u.hostname === hostOnly || u.hostname === 'localhost') {
      return `${base}${u.pathname.replace(/^\//, '')}${u.search}${u.hash}`;
    }
  } catch {
    /* keep */
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    return `${base}${value.replace(/^\//, '')}`;
  }
  return value;
}

/** Root-absolute paths must be prefixed — <base href> does NOT affect them. */
function rewriteRootAbsoluteUrls(content, token) {
  const base = proxyBasePath(token);
  let out = String(content);

  // Strip device <base href="/"> etc. (breaks subpath proxies)
  out = out.replace(/<base\b[^>]*>/gi, '');

  // href="/x" src='/x' action="/x" poster= data-src= formaction=
  out = out.replace(
    /(\s(?:href|src|action|poster|data-src|data-href|formaction)\s*=\s*["'])\/(?!\/)/gi,
    `$1${base}`
  );

  // CSS url(/x) and url("/x")
  out = out.replace(/url\(\s*(['"]?)\/(?!\/)/gi, `url($1${base}`);

  // @import "/x"
  out = out.replace(/@import\s+(['"])\/(?!\/)/gi, `@import $1${base}`);

  return out;
}

function injectClientFixes(html, token) {
  const base = proxyBasePath(token);
  const prefix = base.replace(/\/$/, '');
  const script = `<script>(function(){
var P=${JSON.stringify(prefix)};
function abs(u){
  if(u==null) return u;
  u=String(u);
  if(!u||u.indexOf(P)===0||u.indexOf("data:")===0||u.indexOf("blob:")===0||u.indexOf("mailto:")===0||u.indexOf("javascript:")===0||u.indexOf("#")===0) return u;
  if(u.charAt(0)==="/"&&u.charAt(1)!=="/") return P+u;
  try{
    var x=new URL(u, location.href);
    if(x.origin===location.origin && x.pathname.indexOf(P)!==0){
      if(/\\/(cgi-bin\\/|luci-static\\/|ubus\\/?|luci-mobile)/.test(x.pathname))
        return P+x.pathname+x.search+x.hash;
    }
  }catch(e){}
  return u;
}
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest&&e.target.closest("a[href]");
  if(!a) return;
  var h=a.getAttribute("href");
  if(h) a.setAttribute("href",abs(h));
},true);
document.addEventListener("submit",function(e){
  var f=e.target;
  if(!f||!f.getAttribute) return;
  var a=f.getAttribute("action");
  if(a) f.setAttribute("action",abs(a));
},true);
try{
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){arguments[1]=abs(u);return xo.apply(this,arguments);};
}catch(e){}
try{
  if(window.fetch){
    var _f=window.fetch;
    window.fetch=function(i,n){
      if(typeof i==="string") i=abs(i);
      else if(i&&typeof i.url==="string") i=new Request(abs(i.url),i);
      return _f.call(this,i,n);
    };
  }
}catch(e){}
try{
  var la=Location.prototype.assign, lr=Location.prototype.replace;
  Location.prototype.assign=function(u){return la.call(this,abs(u));};
  Location.prototype.replace=function(u){return lr.call(this,abs(u));};
}catch(e){}
window.addEventListener("unhandledrejection",function(e){
  try{
    var m=String((e&&e.reason&&(e.reason.message||e.reason))||"");
    if(m.indexOf("Access denied")!==-1||m.indexOf("-32002")!==-1){e.preventDefault();}
  }catch(_e){}
});
})();</script>`;

  const baseTag = `<base href="${base}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${script}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}${script}</head>`);
  }
  return `${baseTag}${script}${html}`;
}

function rewriteHtml(html, token) {
  let out = rewriteRootAbsoluteUrls(html, token);

  // Device pages try to bounce http→https://host:443 — that leaves our :3005 proxy and breaks login.
  out = out.replace(
    /if\s*\(\s*document\.location\.protocol\s*!=\s*['"]https:['"]\s*\)\s*\{[\s\S]*?setTimeout\([\s\S]*?\},\s*5000\);[\s\S]*?\}/gi,
    '/* nimbus-proxy: disabled device https://host:443 upgrade redirect */'
  );

  // Keep login inputs usable (Argon label overlays / darkMask can block typing behind a proxy).
  const loginFix = `<style id="nimbus-gui-login-fix">
.login-page input.cbi-input-password,
.login-page input.cbi-input-user,
.login-page input[type="password"],
.login-page input[type="text"]{
  pointer-events:auto!important;
  z-index:60!important;
  position:relative!important;
  min-height:2.2rem!important;
  width:100%!important;
  opacity:1!important;
  -webkit-user-select:text!important;
  user-select:text!important;
}
.login-page .input-group label.border{pointer-events:none!important;}
.login-page .darkMask{display:none!important;pointer-events:none!important;}
</style>`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${loginFix}`);
  } else {
    out = `${loginFix}${out}`;
  }

  return injectClientFixes(out, token);
}

function isHtmlContentType(type) {
  return String(type || '').toLowerCase().includes('text/html');
}

function isCssContentType(type) {
  return String(type || '').toLowerCase().includes('text/css');
}

function isJsContentType(type) {
  const t = String(type || '').toLowerCase();
  return t.includes('javascript') || t.includes('ecmascript');
}

function isJsPath(pathWithQuery) {
  const pathOnly = String(pathWithQuery || '').split('?')[0];
  return /\.m?js$/i.test(pathOnly);
}

/**
 * LuCI registers protocol.* modules on every page. If the device 404s those
 * scripts as HTML, an empty 200 stub makes LuCI throw
 * "factory yields invalid constructor" banners site-wide.
 * Only stub scripts we can safely replace; otherwise return null.
 */
function missingScriptStub(pathWithQuery) {
  const pathOnly = String(pathWithQuery || '').split('?')[0];
  if (/promis/i.test(pathOnly)) {
    return '/* promis.min.js missing on device — modern browsers already provide Promise */\n';
  }

  // Missing protocol plugins (common on custom SD-WAN images): yield a valid Class.
  const proto = pathOnly.match(/\/protocol\/([^/]+)\.js$/i);
  if (proto) {
    const name = String(proto[1] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!name) return null;
    return `'use strict';
'require network';
return network.registerProtocol(${JSON.stringify(name)}, {
  getI18n: function() {
    return ${JSON.stringify(`${name} (unavailable)`)};
  },
  isFloating: function() { return true; },
  isVirtual: function() { return true; }
});
`;
  }

  return null;
}

function stripBrowserSecurityHeaders(res) {
  [
    'Content-Security-Policy',
    'Content-Security-Policy-Report-Only',
    'X-Frame-Options',
    'Cross-Origin-Embedder-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'Origin-Agent-Cluster',
  ].forEach((h) => {
    try {
      res.removeHeader(h);
    } catch {
      /* ignore */
    }
  });
}

function guiTokenCookie(token) {
  const ttl = guiSessionTtlSeconds();
  return `${GUI_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ttl}; SameSite=Lax`;
}

function rewriteSetCookie(value) {
  // Path=/ so sysauth is sent for /ubus and for rescued /cgi-bin requests
  let out = String(value)
    .replace(/;\s*Domain=[^;]*/i, '')
    .replace(/;\s*Secure/gi, '');
  if (/;\s*Path=/i.test(out)) {
    out = out.replace(/;\s*Path=[^;]*/i, '; Path=/');
  } else {
    out = `${out}; Path=/`;
  }
  return out;
}

function sendHtml(res, status, title, bodyHtml) {
  if (res.headersSent) return;
  stripBrowserSecurityHeaders(res);
  res.status(status).type('html');
  Object.entries(guiProxySecurityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;line-height:1.5;background:#111;color:#eee">
  <h1 style="margin-top:0">${title}</h1>
  ${bodyHtml}
</body></html>`);
}

/**
 * Express middleware mounted at /gui-proxy/:token
 * Remaining path+query is in req.url; forwards to device private IP.
 */
export function proxyDeviceGui(req, res) {
  let session;
  try {
    session = verifyGuiAccessToken(req.params.token);
  } catch {
    sendHtml(
      res,
      401,
      'GUI session expired',
      '<p>Return to Device List and open the GUI again.</p>'
    );
    return;
  }

  const protocol = session.protocol === 'http' ? 'http' : 'https';
  const port = Number(session.port) || (protocol === 'http' ? 80 : 443);
  const guiIp = String(session.guiIp || '').trim();
  if (!guiIp) {
    sendHtml(res, 502, 'No GUI IP', '<p>Device has no GUI IP.</p>');
    return;
  }

  const upstreamPath = req.url && req.url !== '' ? req.url : '/';
  const transport = protocol === 'http' ? http : https;
  const headers = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === 'authorization') continue;
    if (key.toLowerCase() === 'accept-encoding') continue;
    if (key.toLowerCase() === 'referer' || key.toLowerCase() === 'origin') continue;
    if (key.toLowerCase() === 'content-length') continue;
    if (key.toLowerCase() === 'transfer-encoding') continue;
    // Forward device session cookies; drop only our proxy tracker cookie
    if (key.toLowerCase() === 'cookie') {
      const forwarded = String(value)
        .split(';')
        .map((c) => c.trim())
        .filter(Boolean)
        .filter((c) => !c.toLowerCase().startsWith(`${GUI_TOKEN_COOKIE}=`))
        .join('; ');
      if (forwarded) headers.cookie = forwarded;
      continue;
    }
    headers[key] = value;
  }
  headers.host = formatHostHeader(guiIp);
  headers['x-forwarded-proto'] = protocol;
  headers['x-forwarded-host'] = formatHostHeader(guiIp);
  headers['accept-encoding'] = 'identity';
  headers.connection = 'close';

  // LuCI CSRF / session checks often validate Referer/Origin against the device host.
  // Browser sends the public proxy URL — rewrite to the upstream device URL.
  const deviceOrigin = `${protocol}://${formatHostHeader(guiIp)}${port === 443 || port === 80 ? '' : `:${port}`}`;
  headers.referer = `${deviceOrigin}/cgi-bin/luci/`;
  headers.origin = deviceOrigin;

  const timeoutMs = Number(process.env.DEVICE_GUI_TIMEOUT_MS) || 10000;
  const targetLabel = `${protocol}://${formatHostHeader(guiIp)}:${port}`;
  let settled = false;

  const fail = (status, title, detail) => {
    if (settled || res.headersSent) return;
    settled = true;
    sendHtml(res, status, title, `<p>Target: <code>${targetLabel}</code></p><p>${detail}</p>`);
  };

  const startUpstream = (bodyBuf) => {
    const reqHeaders = { ...headers };
    if (bodyBuf && bodyBuf.length) {
      reqHeaders['content-length'] = String(bodyBuf.length);
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      reqHeaders['content-length'] = '0';
    }

    const options = {
      hostname: guiIp,
      port,
      path: upstreamPath,
      method: req.method,
      headers: reqHeaders,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    };

    const proxyReq = transport.request(options, (proxyRes) => {
      settled = true;
      stripBrowserSecurityHeaders(res);

      const outHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value == null || HOP_BY_HOP.has(key.toLowerCase())) continue;
        if (key.toLowerCase() === 'content-security-policy') continue;
        if (key.toLowerCase() === 'strict-transport-security') continue;
        if (key.toLowerCase() === 'location') {
          outHeaders[key] = rewriteLocation(String(value), req.params.token, guiIp);
          continue;
        }
        if (key.toLowerCase() === 'set-cookie') {
          outHeaders[key] = (Array.isArray(value) ? value : [value]).map((c) => rewriteSetCookie(c));
          continue;
        }
        outHeaders[key] = value;
      }

      // Remember token so /cgi-bin and /luci-static escapes can be rescued
      const prev = outHeaders['set-cookie'];
      const sessionCookie = guiTokenCookie(req.params.token);
      outHeaders['set-cookie'] = prev
        ? [...(Array.isArray(prev) ? prev : [prev]), sessionCookie]
        : sessionCookie;

      Object.assign(outHeaders, guiProxySecurityHeaders());

      const ctype = proxyRes.headers['content-type'];
      const status = proxyRes.statusCode || 502;

      // Device often 404s missing theme JS as HTML — that breaks MIME checks / LuCI factories.
      if (isJsPath(upstreamPath) && (status === 404 || isHtmlContentType(ctype))) {
        proxyRes.resume();
        const stubSrc = missingScriptStub(upstreamPath);
        if (stubSrc != null) {
          const stub = Buffer.from(stubSrc, 'utf8');
          res.writeHead(200, {
            'content-type': 'application/javascript; charset=utf-8',
            'content-length': String(stub.length),
            'cache-control': 'no-store',
            'set-cookie': outHeaders['set-cookie'],
            ...guiProxySecurityHeaders(),
          });
          res.end(stub);
          return;
        }
        // Unknown missing .js: keep 404 but with a JS MIME so the browser does not parse HTML as script.
        const pathOnly = String(upstreamPath).split('?')[0].replace(/\\/g, '');
        const miss = Buffer.from(`throw new Error(${JSON.stringify(`missing script: ${pathOnly}`)});\n`, 'utf8');
        res.writeHead(404, {
          'content-type': 'application/javascript; charset=utf-8',
          'content-length': String(miss.length),
          'cache-control': 'no-store',
          'set-cookie': outHeaders['set-cookie'],
          ...guiProxySecurityHeaders(),
        });
        res.end(miss);
        return;
      }

      // Never rewrite LuCI .js bodies — string rewriting breaks RPC/session logic.
      const shouldRewrite = isHtmlContentType(ctype) || isCssContentType(ctype);

      if (shouldRewrite) {
        const chunks = [];
        proxyRes.on('data', (c) => chunks.push(c));
        proxyRes.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8');
          if (isHtmlContentType(ctype)) body = rewriteHtml(body, req.params.token);
          else body = rewriteRootAbsoluteUrls(body, req.params.token);

          const buf = Buffer.from(body, 'utf8');
          outHeaders['content-length'] = String(buf.length);
          delete outHeaders['content-encoding'];
          res.writeHead(status, outHeaders);
          res.end(buf);
        });
        proxyRes.on('error', () => fail(502, 'Upstream GUI error', 'Failed reading device response.'));
        return;
      }

      res.writeHead(status, outHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      fail(
        504,
        'Device GUI timed out',
        'The API host could not complete a connection to the device in time.'
      );
    });

    proxyReq.on('error', (err) => {
      fail(
        502,
        'Cannot reach device GUI',
        `${String(err.message || err)}<br/><br/>The API host must route to this private IP (SD-WAN / management network).`
      );
    });

    if (bodyBuf && bodyBuf.length) proxyReq.end(bodyBuf);
    else proxyReq.end();
  };

  // Buffer request body with Content-Length. Chunked POSTs are often dropped by device uhttpd
  // → LuCI sees empty password and returns 403 Forbidden.
  if (req.method === 'GET' || req.method === 'HEAD') {
    startUpstream(null);
    return;
  }

  const bodyFromParsed = () => {
    if (req.body == null) return Buffer.alloc(0);
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
    if (typeof req.body === 'object') {
      const ctype = String(req.headers['content-type'] || '');
      if (ctype.includes('json')) return Buffer.from(JSON.stringify(req.body), 'utf8');
      // urlencoded login form fields (luci_username / luci_password)
      return Buffer.from(new URLSearchParams(req.body).toString(), 'utf8');
    }
    return Buffer.alloc(0);
  };

  const finishBody = (bodyBuf) => {
    if (
      process.env.DEVICE_GUI_DEBUG === '1' &&
      req.method === 'POST' &&
      String(upstreamPath).includes('cgi-bin/luci')
    ) {
      const keys = String(bodyBuf.toString('utf8'))
        .split('&')
        .map((p) => decodeURIComponent((p.split('=')[0] || '').replace(/\+/g, ' ')))
        .filter(Boolean);
      console.log(
        `[gui-proxy] luci POST ${req.method} ${upstreamPath} bytes=${bodyBuf.length} fields=[${keys.join(',')}]`
      );
    }
    startUpstream(bodyBuf);
  };

  // Stream already consumed (rare) — use whatever was parsed, or empty.
  if (req.readableEnded || req.complete) {
    finishBody(bodyFromParsed());
    return;
  }

  const bodyChunks = [];
  let finished = false;
  const onDone = () => {
    if (finished) return;
    finished = true;
    let bodyBuf = bodyChunks.length ? Buffer.concat(bodyChunks) : Buffer.alloc(0);
    if (!bodyBuf.length) bodyBuf = bodyFromParsed();
    finishBody(bodyBuf);
  };

  req.on('data', (c) => bodyChunks.push(c));
  req.on('end', onDone);
  req.on('close', () => {
    // Some clients abort mid-body; still try with what we have
    if (!finished && bodyChunks.length) onDone();
  });
  req.on('error', () => fail(400, 'Bad request', 'Failed reading browser request body.'));
}
