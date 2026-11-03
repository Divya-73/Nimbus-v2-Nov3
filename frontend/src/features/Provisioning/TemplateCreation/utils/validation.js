export function validateTemplateName(name, label = 'Template') {
  const value = String(name || '').trim();
  if (!value) return `${label} name is required`;
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return `${label} name may only contain A-Z, a-z, 0-9, and underscore`;
  }
  return '';
}
