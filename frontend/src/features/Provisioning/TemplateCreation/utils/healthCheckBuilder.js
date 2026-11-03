import { emptyContent, pushSet } from './uci';

export function defaultHealthCheckForm(ttype = 'healthCheck') {
  return {
    tempName: '',
    ttype,
    overWrite: false,
    healthCheck: [],
  };
}

export function buildHealthCheckContent(formObj = {}) {
  const content = emptyContent({
    stop: ['ahhealthcheck'],
    start: ['ahhealthcheck'],
    formValue: formObj,
  });

  if (formObj.overWrite) {
    content.opts.push(`commit && ubus call uci delete '{"config":"ahhealthcheck", "type":"hcheckl"}'`);
  }

  for (const item of formObj.healthCheck || []) {
    content.opts.push('add ahhealthcheck hcheckl');
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].enabled', item.enable ? '1' : '0');
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].name', item.name);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].dev', item.dev);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].ltype', item.ltype);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].addr', item.addr);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].port', item.port);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].interval', item.interval);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].cnt', item.cnt);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].jtms', item.jtms);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].pkl', item.pkl);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].ltms', item.ltms);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].rssi', item.rssi);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].stype', item.stype);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].saddr', item.saddr);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].sport', item.sport);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].sdur', item.sdur);
    pushSet(content.opts, 'ahhealthcheck.@hcheckl[-1].ll', item.ll);
  }

  content.opts.push('commit ahhealthcheck');
  return content;
}
