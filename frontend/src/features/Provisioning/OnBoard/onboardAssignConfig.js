/**
 * Assign-form labels. Slot names and SLA numeric defaults come from
 * GET /onboard/:id (backend deviceStatusConfig.js).
 */
export const ONBOARD_SLA_FIELDS = [
  ['goodF', 'Good from'],
  ['goodT', 'Good to'],
  ['fairF', 'Fair from'],
  ['fairT', 'Fair to'],
  ['poorF', 'Poor from'],
  ['poorT', 'Poor to'],
];

export const EMPTY_SLA = {
  goodF: '',
  goodT: '',
  fairF: '',
  fairT: '',
  poorF: '',
  poorT: '',
};

export function slaFromDevice(device, kind) {
  const src = device?.[kind] || device?.defaults?.[kind] || EMPTY_SLA;
  const out = { ...EMPTY_SLA };
  for (const [key] of ONBOARD_SLA_FIELDS) {
    const value = src[key];
    out[key] = value == null || value === '' ? '' : value;
  }
  return out;
}

/** Numbers for POST /onboard/assign. Blank fields are omitted so backend defaults apply. */
export const INTERFACE_OPERATORS = [
  'Airtel',
  'Jio',
  'VI',
  'BSNL',
  'Tata',
  'Hathway',
  'ACT',
  'RailTel',
  'Sify',
  'Others',
];

export function cloneInterfaceNameMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key || '').trim();
    if (!name) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[name] = {
        op: String(value.op ?? value.operator ?? value.label ?? value.name ?? '').trim(),
        con_id: String(value.con_id ?? value.serviceId ?? value.service_id ?? '').trim(),
      };
    } else {
      out[name] = { op: String(value ?? '').trim(), con_id: '' };
    }
  }
  return out;
}

export function operatorOptions(extra = [], catalog = INTERFACE_OPERATORS) {
  const names = new Set((catalog || INTERFACE_OPERATORS).map((name) => String(name || '').trim()).filter(Boolean));
  for (const name of extra) {
    const value = String(name || '').trim();
    if (value) names.add(value);
  }
  return [...names];
}

/** Numbers for POST /onboard/assign. Blank fields are omitted so backend defaults apply. */
export function slaPayload(obj = {}) {
  const out = {};
  for (const [key] of ONBOARD_SLA_FIELDS) {
    const raw = obj[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}
