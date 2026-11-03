import { commitOnlyContent, emptyContent, isFilled, pushDel, pushSet } from './uci';

export function defaultLanDhcpForm(ttype = 'lanDhcp') {
  return {
    tempName: '',
    ttype,
    interfaceName: '',
    raPreference: '',
    clearRaSlaac: false,
    clearIpaddr: false,
  };
}

export function buildLanDhcpContent(formObj = {}) {
  if (!isFilled(formObj.interfaceName)) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({ formValue: formObj });
  const iface = formObj.interfaceName;

  if (formObj.clearRaSlaac) {
    pushDel(content.opts, `dhcp.${iface}.ra_slaac`);
  }
  pushSet(content.opts, `dhcp.${iface}.ra_preference`, formObj.raPreference);
  if (formObj.clearIpaddr) {
    pushDel(content.opts, `network.${iface}.ipaddr`);
  }
  pushSet(content.opts, `network.${iface}.proto`, 'dhcp');
  content.opts.push('commit dhcp');
  content.opts.push(
    `commit network && ubus call luci setInitAction '{"name":"network", "action":"restart"}'`
  );
  return content;
}
