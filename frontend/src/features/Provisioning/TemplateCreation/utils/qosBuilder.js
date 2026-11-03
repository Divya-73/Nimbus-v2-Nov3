import { emptyContent, pushSet } from './uci';

export function defaultQoServiceForm(ttype = 'QoService') {
  return {
    tempName: '',
    ttype,
    overWriteIface: false,
    overWriteRule: false,
    interfaces: [],
    csfRules: [],
  };
}

export function buildQoServiceContent(formObj = {}) {
  const content = emptyContent({
    stop: ['qos'],
    start: ['qos'],
    formValue: formObj,
  });

  if (formObj.overWriteIface) {
    content.opts.push(`commit && ubus call uci delete '{"config":"qos", "type":"interface"}'`);
  }
  if (formObj.overWriteRule) {
    content.opts.push(`commit && ubus call uci delete '{"config":"qos", "type":"classify"}'`);
  }

  for (const iface of formObj.interfaces || []) {
    if (!iface.name) continue;
    content.opts.push(`set qos.${iface.name}=interface`);
    pushSet(content.opts, `qos.${iface.name}.enabled`, iface.enable ? '1' : '0');
    pushSet(content.opts, `qos.${iface.name}.classgroup`, iface.classgroup);
    pushSet(content.opts, `qos.${iface.name}.overhead`, iface.overhead ? '1' : '0');
    pushSet(content.opts, `qos.${iface.name}.halfduplex`, iface.halfduplex ? '1' : '0');
    pushSet(content.opts, `qos.${iface.name}.download`, iface.download);
    pushSet(content.opts, `qos.${iface.name}.upload`, iface.upload);
    pushSet(content.opts, `qos.${iface.name}.device`, iface.device);
  }

  for (const rule of formObj.csfRules || []) {
    content.opts.push('add qos classify');
    pushSet(content.opts, 'qos.@classify[-1].target', rule.target);
    pushSet(content.opts, 'qos.@classify[-1].srchost', rule.srchost);
    pushSet(content.opts, 'qos.@classify[-1].dsthost', rule.dsthost);
    pushSet(content.opts, 'qos.@classify[-1].proto', rule.proto);
    pushSet(content.opts, 'qos.@classify[-1].ports', rule.ports);
    pushSet(content.opts, 'qos.@classify[-1].connbytes', rule.connbytes);
    pushSet(content.opts, 'qos.@classify[-1].comment', rule.comment);
  }

  content.opts.push('commit qos');
  return content;
}
