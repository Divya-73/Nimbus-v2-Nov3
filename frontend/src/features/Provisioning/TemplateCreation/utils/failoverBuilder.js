import { commitOnlyContent, emptyContent, isFilled, pushSet } from './uci';

export function defaultFailoverForm(ttype = 'failover') {
  return {
    tempName: '',
    ttype,
    interfaces: [],
  };
}

export function buildFailoverContent(formObj = {}) {
  const stop = ['network'];
  const start = ['network'];
  const hasConfig = (formObj.interfaces || []).some((iface) => isFilled(iface?.name));

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({
    stop,
    start,
    formValue: formObj,
  });

  for (const iface of formObj.interfaces || []) {
    if (!iface?.name) continue;
    pushSet(content.opts, `network.${iface.name}.metric`, iface.metric);
  }

  content.opts.push('commit network');
  return content;
}
