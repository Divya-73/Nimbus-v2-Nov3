import { emptyContent, pushSet } from './uci';

export function defaultRouteForm(ttype = 'route') {
  return {
    tempName: '',
    ttype,
    overWrite: false,
    routes: [],
  };
}

export function buildRouteContent(formObj = {}) {
  const content = emptyContent({
    restart: ['network'],
    formValue: formObj,
  });

  if (formObj.overWrite) {
    content.opts.push(`commit && ubus call uci delete '{"config":"network", "type":"route"}'`);
  }

  for (const route of formObj.routes || []) {
    content.opts.push('add network route');
    pushSet(content.opts, 'network.@route[-1].interface', route.interface);
    pushSet(content.opts, 'network.@route[-1].target', route.target);
    pushSet(content.opts, 'network.@route[-1].netmask', route.netmask);
    pushSet(content.opts, 'network.@route[-1].gateway', route.gateway);
    pushSet(content.opts, 'network.@route[-1].metric', route.metric);
    pushSet(content.opts, 'network.@route[-1].mtu', route.mtu);
    pushSet(content.opts, 'network.@route[-1].type', route.type);
    pushSet(content.opts, 'network.@route[-1].table', route.table);
    pushSet(content.opts, 'network.@route[-1].source', route.source);
  }

  content.opts.push('commit network');
  return content;
}
