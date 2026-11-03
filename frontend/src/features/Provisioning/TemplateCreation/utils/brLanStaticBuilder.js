import { commitOnlyContent, emptyContent, isFilled, pushDelete, pushSet } from './uci';

export function defaultBrLanStaticForm(ttype = 'brLanStatic') {
  return {
    tempName: '',
    ttype,
    section: '',
    device: '',
    ipaddr: '',
    netmask: '',
    gateway: '',
  };
}

export function buildBrLanStaticContent(formObj = {}) {
  const hasConfig =
    isFilled(formObj.section) ||
    isFilled(formObj.device) ||
    isFilled(formObj.ipaddr) ||
    isFilled(formObj.netmask) ||
    isFilled(formObj.gateway);

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({ formValue: formObj });
  const section = formObj.section;

  pushDelete(content.opts, `network.${section}`);
  content.opts.push(`set network.${section}=interface`);
  pushSet(content.opts, `network.${section}.proto`, 'static');
  pushSet(content.opts, `network.${section}.device`, formObj.device);
  pushSet(content.opts, `network.${section}.ipaddr`, formObj.ipaddr);
  pushSet(content.opts, `network.${section}.netmask`, formObj.netmask);
  pushSet(content.opts, `network.${section}.gateway`, formObj.gateway);
  content.opts.push(
    `commit network && ubus call luci setInitAction '{"name":"network", "action":"restart"}'`
  );
  return content;
}
