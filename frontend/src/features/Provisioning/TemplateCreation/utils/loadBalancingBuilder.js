import { commitOnlyContent, emptyContent, hasNamedItems, pushList, pushSet } from './uci';

function safeName(value, fallback = 'item') {
  const name = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_');
  return name || fallback;
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => v !== '' && v != null);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function defaultLoadBalancingForm(ttype = 'loadBalancing') {
  return {
    tempName: '',
    ttype,
    overWriteIface: false,
    overWriteMember: false,
    overWritePolicy: false,
    overWriteRule: false,
    globals: {
      mmx_mask: '0xff00',
      logging: false,
      loglevel: 'notice',
      rtmon_interval: '',
    },
    interfaces: [],
    members: [],
    policies: [],
    rules: [],
  };
}

export function buildLoadBalancingContent(formObj = {}) {
  const hasConfig =
    formObj.overWriteIface ||
    formObj.overWriteMember ||
    formObj.overWritePolicy ||
    formObj.overWriteRule ||
    hasNamedItems(formObj.interfaces) ||
    hasNamedItems(formObj.members) ||
    hasNamedItems(formObj.policies) ||
    hasNamedItems(formObj.rules);

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({
    start: ['mwan3'],
    formValue: formObj,
  });

  if (formObj.overWriteIface) {
    content.opts.push(`commit && ubus call uci delete '{"config":"mwan3", "type":"interface"}'`);
  }
  if (formObj.overWriteMember) {
    content.opts.push(`commit && ubus call uci delete '{"config":"mwan3", "type":"member"}'`);
  }
  if (formObj.overWritePolicy) {
    content.opts.push(`commit && ubus call uci delete '{"config":"mwan3", "type":"policy"}'`);
  }
  if (formObj.overWriteRule) {
    content.opts.push(`commit && ubus call uci delete '{"config":"mwan3", "type":"rule"}'`);
  }

  const globals = formObj.globals || {};
  content.opts.push(`set mwan3.globals='globals'`);
  pushSet(content.opts, 'mwan3.globals.mmx_mask', globals.mmx_mask || '0xff00');
  pushSet(content.opts, 'mwan3.globals.logging', globals.logging ? '1' : '0');
  pushSet(content.opts, 'mwan3.globals.loglevel', globals.loglevel);
  pushSet(content.opts, 'mwan3.globals.rtmon_interval', globals.rtmon_interval);

  for (const iface of formObj.interfaces || []) {
    const name = safeName(iface.name, 'wan');
    content.opts.push(`set mwan3.${name}='interface'`);
    pushSet(content.opts, `mwan3.${name}.enabled`, iface.enabled === false ? '0' : '1');
    pushSet(content.opts, `mwan3.${name}.initial_state`, iface.initial || 'online');
    pushSet(content.opts, `mwan3.${name}.family`, iface.internet === 'IPv6' ? 'ipv6' : 'ipv4');
    content.opts.push(`del mwan3.${name}.track_ip`);
    pushList(content.opts, `mwan3.${name}.track_ip`, asList(iface.trackingHostname));
    pushSet(content.opts, `mwan3.${name}.reliability`, iface.reliability);
    pushSet(content.opts, `mwan3.${name}.count`, iface.count);
    pushSet(content.opts, `mwan3.${name}.timeout`, iface.timeout);
    pushSet(content.opts, `mwan3.${name}.interval`, iface.interval);
    pushSet(content.opts, `mwan3.${name}.down`, iface.down);
    pushSet(content.opts, `mwan3.${name}.up`, iface.up);
  }

  for (const member of formObj.members || []) {
    const name = safeName(member.name, 'member');
    content.opts.push(`set mwan3.${name}='member'`);
    pushSet(content.opts, `mwan3.${name}.interface`, member.interface);
    pushSet(content.opts, `mwan3.${name}.metric`, member.metric);
    pushSet(content.opts, `mwan3.${name}.weight`, member.weight);
  }

  for (const policy of formObj.policies || []) {
    const name = safeName(policy.name, 'policy');
    content.opts.push(`set mwan3.${name}='policy'`);
    content.opts.push(`del mwan3.${name}.use_member`);
    pushList(content.opts, `mwan3.${name}.use_member`, asList(policy.use_member));
    pushSet(content.opts, `mwan3.${name}.last_resort`, policy.last_resort);
  }

  for (const rule of formObj.rules || []) {
    const name = safeName(rule.name, 'rule');
    content.opts.push(`set mwan3.${name}='rule'`);
    pushSet(content.opts, `mwan3.${name}.proto`, rule.proto || 'all');
    pushSet(content.opts, `mwan3.${name}.src_ip`, rule.src_ip);
    pushSet(content.opts, `mwan3.${name}.src_port`, rule.src_port);
    pushSet(content.opts, `mwan3.${name}.dest_ip`, rule.dest_ip);
    pushSet(content.opts, `mwan3.${name}.dest_port`, rule.dest_port);
    pushSet(content.opts, `mwan3.${name}.use_policy`, rule.use_policy);
    pushSet(content.opts, `mwan3.${name}.sticky`, rule.sticky ? '1' : '');
  }

  content.opts.push('commit mwan3');
  return content;
}
