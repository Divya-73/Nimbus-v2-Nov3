import { emptyContent, pushDel, pushSet } from './uci';

export function defaultSDWanRouteForm(ttype = 'SDWanRoute') {
  return {
    tempName: '',
    ttype,
    overWrite: false,
    enabled: true,
    interval: 60,
    routes: [],
  };
}

export function buildSDWanRouteContent(formObj = {}) {
  const content = emptyContent({
    stop: ['ahsdwan'],
    start: ['ahsdwan'],
    formValue: formObj,
  });

  if (formObj.overWrite) {
    content.opts.push(`commit && ubus call uci delete '{"config":"ahsdwan", "type":"route"}'`);
  }

  pushSet(content.opts, 'ahsdwan.globals.interval', formObj.interval ?? 60);
  if (formObj.enabled) pushSet(content.opts, 'ahsdwan.globals.enabled', '1');
  else pushDel(content.opts, 'ahsdwan.globals.enabled');

  for (const route of formObj.routes || []) {
    content.opts.push('add ahsdwan route');
    pushSet(content.opts, 'ahsdwan.@route[-1].fthres', route.fthres);
    pushSet(content.opts, 'ahsdwan.@route[-1].prefix', route.prefix);
    pushSet(content.opts, 'ahsdwan.@route[-1].iface1', route.iface1);
    pushSet(content.opts, 'ahsdwan.@route[-1].metric1', route.metric1);
    pushSet(content.opts, 'ahsdwan.@route[-1].hcheck1', route.hcheck1);
    pushSet(content.opts, 'ahsdwan.@route[-1].iface2', route.iface2);
    pushSet(content.opts, 'ahsdwan.@route[-1].metric2', route.metric2);
    pushSet(content.opts, 'ahsdwan.@route[-1].hcheck2', route.hcheck2);
  }

  content.opts.push('commit ahsdwan');
  return content;
}
