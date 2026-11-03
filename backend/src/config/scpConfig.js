import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

function resolveFromBackendRoot(input) {
  if (!input) return '';
  return path.isAbsolute(input) ? input : path.resolve(backendRoot, input);
}

function statusError(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function safeSegment(value, fallback = 'file') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 64);
  return cleaned || fallback;
}

export function getScpConfig() {
  return {
    host: env('SCP_HOST') || env('CP_HOST'),
    port: env('SCP_PORT'),
    user: env('SCP_USER') || env('SCP_USERNAME'),
    pass: env('SCP_PASS') || env('SCP_PASSWORD'),
    path: resolveFromBackendRoot(env('SCP_PATH', 'uploads/scp-output')),
  };
}

export function assertScpConfig(config = getScpConfig()) {
  const missing = [];
  if (!config.host) missing.push('SCP_HOST');
  if (!config.port) missing.push('SCP_PORT');
  if (!config.user) missing.push('SCP_USER');
  if (!config.pass) missing.push('SCP_PASS');
  if (!config.path) missing.push('SCP_PATH');
  if (missing.length) {
    statusError(`SCP configuration is missing: ${missing.join(', ')}`, 500);
  }
}

export function getFirmwareDir() {
  return resolveFromBackendRoot(env('FIRMWARE_DIR', 'uploads/firmware'));
}

export function assertPathInside(baseDir, targetPath, message = 'Path is not allowed') {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const inside = target === base || target.startsWith(`${base}${path.sep}`);
  if (!inside) statusError(message, 403);
  return target;
}

export function getCommandOutputPath(reqId, cmd) {
  const scp = getScpConfig();
  assertScpConfig(scp);
  const fileName = `${safeSegment(reqId, 'req')}-${safeSegment(cmd, 'cmd')}.txt`;
  const filePath = path.join(scp.path, fileName);
  return assertPathInside(scp.path, filePath, 'Output file path is not allowed');
}

export function ensureOutputPlaceholder(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
  } catch {
    // Placeholder creation is best-effort.
  }
}

export async function listFirmwareFiles(model) {
  const requestedModel = String(model || '').trim();
  if (!requestedModel) statusError('model is required', 400);

  const firmwareBaseDir = getFirmwareDir();
  const modelDir = path.resolve(firmwareBaseDir, safeSegment(requestedModel, 'model'));
  assertPathInside(firmwareBaseDir, modelDir, 'Firmware path is not allowed');

  try {
    if (!fs.existsSync(modelDir)) return [];
    const entries = await fs.promises.readdir(modelDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bin'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function resolveFirmwarePath(model, firmwareName) {
  const firmwareBaseDir = getFirmwareDir();
  const modelDir = path.resolve(firmwareBaseDir, safeSegment(model, 'model'));
  const requested = path.join(modelDir, path.basename(String(firmwareName || '').trim()));
  const resolved = assertPathInside(modelDir, requested, 'Firmware path is not allowed');
  if (!fs.existsSync(resolved)) statusError('Firmware not found', 404);
  return resolved;
}

export function resolveOutputFile(filePath) {
  const scp = getScpConfig();
  if (!filePath) statusError('Output file not available for this task', 404);
  const resolved = assertPathInside(scp.path, filePath, 'Output file path is not allowed');
  if (!fs.existsSync(resolved)) statusError('Output file not found yet', 404);
  return resolved;
}

export async function readOutputFile(filePath) {
  const resolved = resolveOutputFile(filePath);
  const content = await fs.promises.readFile(resolved, 'utf8');
  return { fileName: path.basename(resolved), content };
}
