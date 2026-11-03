import { commitOnlyContent, emptyContent, isFilled, pushList, pushSet } from './uci';

export function defaultVlanForm(ttype = 'vlan') {
  return {
    tempName: '',
    ttype,
    vlanName: '',
    vlanId: '',
    baseDevice: '',
    deviceName: '',
    ipaddr: '',
    netmask: '',
    dhcpStart: '',
    dhcpLimit: '',
    leaseTime: '',
    dhcpv4: 'server',
    zoneInput: 'ACCEPT',
    zoneOutput: 'ACCEPT',
    zoneForward: 'ACCEPT',
    masq: false,
    bridgePort: '',
    firewallZoneSection: '',
  };
}

export function buildVlanContent(formObj = {}) {
  const hasConfig =
    isFilled(formObj.vlanName) ||
    isFilled(formObj.vlanId) ||
    isFilled(formObj.baseDevice) ||
    isFilled(formObj.deviceName) ||
    isFilled(formObj.ipaddr) ||
    isFilled(formObj.netmask) ||
    isFilled(formObj.dhcpStart) ||
    isFilled(formObj.dhcpLimit) ||
    isFilled(formObj.leaseTime) ||
    isFilled(formObj.bridgePort) ||
    isFilled(formObj.firewallZoneSection);

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({ formValue: formObj });
  const name = formObj.vlanName;
  const vid = formObj.vlanId;
  const base = formObj.baseDevice;
  const device = formObj.deviceName || (base && vid ? `${base}.${vid}` : '');
  const zoneSection = formObj.firewallZoneSection;

  content.opts.push(`set dhcp.${name}=dhcp`);
  pushSet(content.opts, `dhcp.${name}.interface`, name);
  pushSet(content.opts, `dhcp.${name}.start`, formObj.dhcpStart);
  pushSet(content.opts, `dhcp.${name}.limit`, formObj.dhcpLimit);
  pushSet(content.opts, `dhcp.${name}.leasetime`, formObj.leaseTime);
  pushSet(content.opts, `dhcp.${name}.dhcpv4`, formObj.dhcpv4 || 'server');

  content.opts.push(`delete firewall.${zoneSection}.network`);
  pushList(content.opts, `firewall.${zoneSection}.network`, ['lan', name]);

  content.opts.push('add firewall zone');
  pushSet(content.opts, 'firewall.@zone[-1].name', name);
  pushSet(content.opts, 'firewall.@zone[-1].input', formObj.zoneInput || 'ACCEPT');
  pushSet(content.opts, 'firewall.@zone[-1].output', formObj.zoneOutput || 'ACCEPT');
  pushSet(content.opts, 'firewall.@zone[-1].forward', formObj.zoneForward || 'ACCEPT');
  pushSet(content.opts, 'firewall.@zone[-1].masq', formObj.masq ? '1' : '0');
  pushList(content.opts, 'firewall.@zone[-1].network', ['lan']);

  content.opts.push('add network device');
  pushSet(content.opts, 'network.@device[-1].type', '8021q');
  pushSet(content.opts, 'network.@device[-1].ifname', base);
  pushSet(content.opts, 'network.@device[-1].vid', vid);
  pushSet(content.opts, 'network.@device[-1].name', device);

  content.opts.push(`set network.${name}=interface`);
  pushSet(content.opts, `network.${name}.proto`, 'static');
  pushSet(content.opts, `network.${name}.device`, device);
  pushSet(content.opts, `network.${name}.ipaddr`, formObj.ipaddr);
  pushSet(content.opts, `network.${name}.netmask`, formObj.netmask);
  pushSet(content.opts, `network.${name}.multipath`, 'off');

  content.opts.push('add network bridge-vlan');
  pushSet(content.opts, 'network.@bridge-vlan[-1].device', base);
  pushSet(content.opts, 'network.@bridge-vlan[-1].vlan', vid);
  pushList(content.opts, 'network.@bridge-vlan[-1].ports', formObj.bridgePort ? [formObj.bridgePort] : []);

  content.opts.push('commit dhcp');
  content.opts.push('commit firewall');
  content.opts.push(
    `commit network && ubus call luci setInitAction '{"name":"network", "action":"restart"}'`
  );
  return content;
}
