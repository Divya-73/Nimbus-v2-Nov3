import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(backendRoot, 'templates');

const MERGE_ARRAY_FIELDS = ['opts', 'stop', 'start', 'restart', 'trunc'];

function invalidFilenameError() {
  const err = new Error('Invalid template filename');
  err.status = 400;
  return err;
}

async function ensureTemplateDir() {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
}

function resolveTemplatePath(filename) {
  const name = String(filename || '').trim();
  if (!name) throw invalidFilenameError();

  const base = path.basename(name);
  if (base !== name) throw invalidFilenameError();

  const fullPath = path.join(TEMPLATE_DIR, base);
  const relative = path.relative(TEMPLATE_DIR, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw invalidFilenameError();
  }

  return fullPath;
}

function parseContent(content) {
  if (typeof content === 'string') return JSON.parse(content);
  return content;
}

function sanitizeFilenameSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function buildFilePayload(content, formValue) {
  const payload = parseContent(content);
  if (formValue !== undefined) {
    payload.formValue = formValue;
  }
  return payload;
}

export function buildTemplateFilename(
  tempName,
  { master = false, id = '', orgId = '', model = '' } = {}
) {
  const parts = [
    master ? 'master' : 'template',
    sanitizeFilenameSegment(orgId) || 'org',
    sanitizeFilenameSegment(model) || 'model',
    sanitizeFilenameSegment(tempName) || 'template',
    sanitizeFilenameSegment(id) || 'file',
  ];

  return `${parts.join('_')}.json`;
}

export async function saveTemplateFile(filename, content, formValue) {
  await ensureTemplateDir();
  const filePath = resolveTemplatePath(filename);
  const payload = buildFilePayload(content, formValue);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filename;
}

export async function loadTemplateFile(filename) {
  const filePath = resolveTemplatePath(filename);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function deleteTemplateFile(filename) {
  if (!filename) return;

  try {
    const filePath = resolveTemplatePath(filename);
    await fs.unlink(filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

export async function combineMasterTemplate(templates = []) {
  const combined = {
    opts: [],
    stop: [],
    start: [],
    restart: [],
  };
  const formValues = [];

  for (const template of templates) {
    if (!template?.temp_file) {
      const err = new Error(`Template "${template?.temp_name || template?.id || 'unknown'}" has no file`);
      err.status = 400;
      throw err;
    }

    const content = await loadTemplateFile(template.temp_file);

    for (const field of MERGE_ARRAY_FIELDS) {
      if (Array.isArray(content[field])) {
        combined[field].push(...content[field]);
      }
    }

    if (content.formValue !== undefined) {
      formValues.push(content.formValue);
    }
  }

  if (formValues.length === 1) {
    combined.formValue = formValues[0];
  } else if (formValues.length > 1) {
    combined.formValue = formValues;
  }

  return combined;
}

export { validateTemplateName } from './templateValidator.js';
