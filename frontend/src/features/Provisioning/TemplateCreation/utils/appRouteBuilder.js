import { commitOnlyContent, emptyContent, hasNamedItems, pushSet } from './uci';

export function defaultAppRouteForm(ttype = 'appRoute') {
  return {
    tempName: '',
    ttype,
    appRoute: [],
  };
}

export function buildAppRouteContent(formObj = {}) {
  const hasConfig = hasNamedItems(formObj.appRoute);

  if (!hasConfig) {
    return commitOnlyContent({ formValue: formObj });
  }

  const content = emptyContent({
    start: ['firewall'],
    formValue: formObj,
  });

  for (const route of formObj.appRoute || []) {
    if (!route?.name) continue;
    content.opts.push('add firewall rule');
    pushSet(content.opts, 'firewall.@rule[-1].name', route.name);
    pushSet(content.opts, 'firewall.@rule[-1].enabled', route.enable === false ? '0' : '1');
    const proto = String(route.protocol || 'All').toLowerCase();
    pushSet(content.opts, 'firewall.@rule[-1].proto', proto === 'all' ? 'all' : proto);
    pushSet(content.opts, 'firewall.@rule[-1].src', route.sourceZone);
    pushSet(content.opts, 'firewall.@rule[-1].src_ip', route.sourceIP);
    pushSet(content.opts, 'firewall.@rule[-1].src_port', route.sourcePort);
    pushSet(content.opts, 'firewall.@rule[-1].dest', route.destinationZone);
    pushSet(content.opts, 'firewall.@rule[-1].dest_ip', route.destinationIP);
    pushSet(content.opts, 'firewall.@rule[-1].dest_port', route.destinationPort);
    pushSet(
      content.opts,
      'firewall.@rule[-1].target',
      String(route.action || 'accept').toUpperCase()
    );
  }

  content.opts.push('commit firewall');
  return content;
}
