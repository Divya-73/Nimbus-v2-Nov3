import { emptyContent, pushList, pushSet } from './uci';

export function defaultFirewallForm(ttype = 'firewall') {
  return {
    tempName: '',
    ttype,
    overWriteZones: false,
    generalSettings: { zones: [] },
    portForwards: [],
    trafficRules: [],
    natRules: [],
  };
}

export function buildFirewallContent(formObj = {}) {
  const content = emptyContent({
    stop: ['firewall'],
    start: ['firewall'],
    formValue: formObj,
  });

  if (formObj.overWriteZones || formObj.generalSettings?.overWriteZones) {
    content.opts.push(`commit && ubus call uci delete '{"config":"firewall", "type":"zone"}'`);
  }

  for (const zone of formObj.generalSettings?.zones || []) {
    content.opts.push('add firewall zone');
    pushSet(content.opts, 'firewall.@zone[-1].name', zone.name);
    pushSet(content.opts, 'firewall.@zone[-1].input', zone.input);
    pushSet(content.opts, 'firewall.@zone[-1].output', zone.output);
    pushSet(content.opts, 'firewall.@zone[-1].forward', zone.forward);
    pushSet(content.opts, 'firewall.@zone[-1].family', zone.family);
    pushSet(content.opts, 'firewall.@zone[-1].masq', zone.masq ? '1' : '');
    pushSet(content.opts, 'firewall.@zone[-1].mtu_fix', zone.mtu_fix ? '1' : '');
    pushSet(content.opts, 'firewall.@zone[-1].log', zone.log ? '1' : '');
    pushSet(content.opts, 'firewall.@zone[-1].log_limit', zone.log_limit);
    pushSet(content.opts, 'firewall.@zone[-1].extra_src', zone.extra_src);
    pushSet(content.opts, 'firewall.@zone[-1].extra_dest', zone.extra_dest);
    pushList(content.opts, 'firewall.@zone[-1].network', zone.network);
    pushList(content.opts, 'firewall.@zone[-1].device', zone.device);
    pushList(content.opts, 'firewall.@zone[-1].subnet', zone.subnet);

    for (const dest of zone.out || []) {
      content.opts.push('add firewall forwarding');
      pushSet(content.opts, 'firewall.@forwarding[-1].src', zone.name);
      pushSet(content.opts, 'firewall.@forwarding[-1].dest', dest);
    }
  }

  for (const rule of formObj.portForwards || []) {
    content.opts.push('add firewall redirect');
    pushSet(content.opts, 'firewall.@redirect[-1].name', rule.name);
    pushSet(content.opts, 'firewall.@redirect[-1].src', rule.src);
    pushSet(content.opts, 'firewall.@redirect[-1].src_dport', rule.src_dport);
    pushSet(content.opts, 'firewall.@redirect[-1].dest', rule.dest);
    pushSet(content.opts, 'firewall.@redirect[-1].dest_ip', rule.dest_ip);
    pushSet(content.opts, 'firewall.@redirect[-1].dest_port', rule.dest_port);
    pushList(content.opts, 'firewall.@redirect[-1].proto', rule.proto);
    pushSet(content.opts, 'firewall.@redirect[-1].src_ip', rule.src_ip);
    pushSet(content.opts, 'firewall.@redirect[-1].reflection', rule.reflection ? '1' : '');
  }

  for (const rule of formObj.trafficRules || []) {
    content.opts.push('add firewall rule');
    pushSet(content.opts, 'firewall.@rule[-1].name', rule.name);
    pushSet(content.opts, 'firewall.@rule[-1].src', rule.src);
    pushSet(content.opts, 'firewall.@rule[-1].dest', rule.dest);
    pushSet(content.opts, 'firewall.@rule[-1].dest_port', rule.dest_port);
    pushSet(content.opts, 'firewall.@rule[-1].target', rule.target || rule.action);
    pushList(content.opts, 'firewall.@rule[-1].proto', rule.proto);
    pushSet(content.opts, 'firewall.@rule[-1].src_ip', rule.src_ip);
    pushSet(content.opts, 'firewall.@rule[-1].dest_ip', rule.dest_ip);
  }

  for (const rule of formObj.natRules || []) {
    content.opts.push('add firewall nat');
    pushSet(content.opts, 'firewall.@nat[-1].name', rule.name);
    pushSet(content.opts, 'firewall.@nat[-1].src', rule.src);
    pushSet(content.opts, 'firewall.@nat[-1].src_ip', rule.src_ip);
    pushSet(content.opts, 'firewall.@nat[-1].dest_ip', rule.dest_ip);
    pushSet(content.opts, 'firewall.@nat[-1].snat_ip', rule.snat_ip);
    pushSet(content.opts, 'firewall.@nat[-1].target', rule.action);
    pushList(content.opts, 'firewall.@nat[-1].proto', rule.proto);
  }

  content.opts.push('commit firewall');
  return content;
}
