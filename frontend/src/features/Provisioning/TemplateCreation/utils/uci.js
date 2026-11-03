function toUciBool(value) {
  if (value === true || value === 1 || value === '1') return '1';
  if (value === false || value === 0 || value === '0') return '0';
  return value == null ? '' : String(value);
}

export function pushSet(opts, path, value) {
  if (value === undefined || value === null || value === '') return;
  opts.push(`set ${path}='${toUciBool(value)}'`);
}

export function pushList(opts, path, values = []) {
  const list = Array.isArray(values) ? values : [values];
  list.filter((v) => v !== undefined && v !== null && String(v).trim() !== '').forEach((value) => {
    opts.push(`add_list ${path}='${value}'`);
  });
}

export function pushDel(opts, path) {
  opts.push(`del ${path}`);
}

export function emptyContent(extra = {}) {
  return {
    stop: [],
    opts: [],
    start: [],
    restart: [],
    trunc: [],
    ...extra,
  };
}

export function pushDelete(opts, path) {
  opts.push(`delete ${path}`);
}

export function isFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function hasNamedItems(items = [], nameKey = 'name') {
  return (items || []).some((item) => isFilled(item?.[nameKey]));
}

export function commitOnlyContent({ stop = [], start = [], restart = [], trunc = [], commit, formValue }) {
  return emptyContent({
    stop,
    start,
    restart,
    trunc,
    opts: commit ? [commit] : [],
    formValue,
  });
}
