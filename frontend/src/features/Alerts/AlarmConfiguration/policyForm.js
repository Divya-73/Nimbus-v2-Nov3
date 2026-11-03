export const OBJECT_LEVELS = ['Incident', 'Threshold', 'Monitored'];
export const SEVERITY_LEVELS = ['Critical', 'Warning', 'Informational'];
export const LTE_LIST = ['LTE1', 'LTE2'];

export const EMPTY_POLICY = {
  policy_name: '',
  include: [],
  enpolicy: 1,
  dev_status: { status: 0, olevel: 'Incident', slevel: 'Critical' },
  link_status: { status: 0, olevel: 'Incident', slevel: 'Critical' },
  dev_health: {
    status: 0,
    olevel: 'Threshold',
    slevel: 'Warning',
    cpu: '',
    mem: '',
    wan1: '',
    wan2: '',
    wan3: '',
    wan4: '',
  },
  lte_health: {
    status: 0,
    olevel: 'Threshold',
    slevel: 'Warning',
    LTE1: { status: 0, dbm: '', lostp: '', latency: '' },
    LTE2: { status: 0, dbm: '', lostp: '', latency: '' },
  },
  email: '',
  enemail: 0,
  apiURL: '',
  enApiURL: 0,
};

export function toBool(value) {
  return value === 1 || value === true || value === '1';
}

export function toNumBool(value) {
  return value === 1 || value === true || value === '1' ? 1 : 0;
}

function radioFrom(source = {}) {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return {
      status: toNumBool(source.status),
      dbm: source.dbm ?? '',
      lostp: source.lostp ?? '',
      latency: source.latency ?? '',
    };
  }
  return { status: 0, dbm: '', lostp: '', latency: '' };
}

export function policyFromApi(policy = {}) {
  return {
    ...EMPTY_POLICY,
    ...policy,
    policy_name: policy.policy_name || '',
    include: Array.isArray(policy.include) ? policy.include.map((item) => String(item)) : [],
    enpolicy: toNumBool(policy.enpolicy ?? 1),
    email: policy.email || '',
    enemail: toNumBool(policy.enemail),
    apiURL: policy.apiURL || '',
    enApiURL: toNumBool(policy.enApiURL),
    dev_status: {
      ...EMPTY_POLICY.dev_status,
      ...policy.dev_status,
      status: toNumBool(policy.dev_status?.status),
    },
    link_status: {
      ...EMPTY_POLICY.link_status,
      ...policy.link_status,
      status: toNumBool(policy.link_status?.status),
    },
    dev_health: {
      ...EMPTY_POLICY.dev_health,
      ...policy.dev_health,
      status: toNumBool(policy.dev_health?.status),
    },
    lte_health: {
      ...EMPTY_POLICY.lte_health,
      ...policy.lte_health,
      status: toNumBool(policy.lte_health?.status),
      LTE1: radioFrom(policy.lte_health?.LTE1),
      LTE2: radioFrom(policy.lte_health?.LTE2),
    },
  };
}

export function policyToPayload(form) {
  return {
    ...form,
    policy_name: String(form.policy_name || '').trim(),
    include: Array.isArray(form.include) ? form.include.map(String) : [],
    enpolicy: toNumBool(form.enpolicy),
    enemail: toNumBool(form.enemail),
    enApiURL: toNumBool(form.enApiURL),
    email: String(form.email || '').trim(),
    apiURL: String(form.apiURL || '').trim(),
    dev_status: { ...form.dev_status, status: toNumBool(form.dev_status.status) },
    link_status: { ...form.link_status, status: toNumBool(form.link_status.status) },
    dev_health: { ...form.dev_health, status: toNumBool(form.dev_health.status) },
    lte_health: {
      ...form.lte_health,
      status: toNumBool(form.lte_health.status),
      LTE1: { ...form.lte_health.LTE1, status: toNumBool(form.lte_health.LTE1.status) },
      LTE2: { ...form.lte_health.LTE2, status: toNumBool(form.lte_health.LTE2.status) },
    },
  };
}

export function formatPolicyTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

export function enabledRuleCount(policy = {}) {
  return [
    toBool(policy.dev_status?.status),
    toBool(policy.link_status?.status),
    toBool(policy.dev_health?.status),
    toBool(policy.lte_health?.status),
  ].filter(Boolean).length;
}
