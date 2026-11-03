import { buildFirewallContent, defaultFirewallForm } from './firewallBuilder';
import { buildRouteContent, defaultRouteForm } from './routeBuilder';
import { buildHealthCheckContent, defaultHealthCheckForm } from './healthCheckBuilder';
import { buildSDWanRouteContent, defaultSDWanRouteForm } from './sdWanRouteBuilder';
import { buildQoServiceContent, defaultQoServiceForm } from './qosBuilder';
import { buildWirelessContent, defaultWirelessForm } from './wirelessBuilder';
import { buildSystemContent, defaultSystemForm } from './systemBuilder';
import { buildNimbusContent, defaultNimbusForm } from './nimbusBuilder';
import { buildUrlFilterContent, defaultUrlFilterForm } from './urlFilterBuilder';
import { buildIpsecContent, defaultIpsecForm } from './ipsecBuilder';
import { buildInterfaceContent, defaultInterfaceForm, interfaceDefaultsForMode } from './interfaceBuilder';
import { buildVlanContent, defaultVlanForm } from './vlanBuilder';
import { buildFailoverContent, defaultFailoverForm } from './failoverBuilder';
import { buildLanDhcpContent, defaultLanDhcpForm } from './lanDhcpBuilder';
import { buildBrLanStaticContent, defaultBrLanStaticForm } from './brLanStaticBuilder';
import { buildAppRouteContent, defaultAppRouteForm } from './appRouteBuilder';
import { buildLoadBalancingContent, defaultLoadBalancingForm } from './loadBalancingBuilder';
import { validateTemplateName } from './validation';

const DEFAULTS = {
  firewall: defaultFirewallForm,
  route: defaultRouteForm,
  healthCheck: defaultHealthCheckForm,
  SDWanRoute: defaultSDWanRouteForm,
  QoService: defaultQoServiceForm,
  wireless: defaultWirelessForm,
  system: defaultSystemForm,
  nimbus: defaultNimbusForm,
  url_filter: defaultUrlFilterForm,
  ipsec: defaultIpsecForm,
  interface: defaultInterfaceForm,
  vlan: defaultVlanForm,
  failover: defaultFailoverForm,
  lanDhcp: defaultLanDhcpForm,
  brLanStatic: defaultBrLanStaticForm,
  appRoute: defaultAppRouteForm,
  loadBalancing: defaultLoadBalancingForm,
};

const BUILDERS = {
  firewall: buildFirewallContent,
  route: buildRouteContent,
  healthCheck: buildHealthCheckContent,
  SDWanRoute: buildSDWanRouteContent,
  QoService: buildQoServiceContent,
  wireless: buildWirelessContent,
  system: buildSystemContent,
  nimbus: buildNimbusContent,
  url_filter: buildUrlFilterContent,
  ipsec: buildIpsecContent,
  interface: buildInterfaceContent,
  vlan: buildVlanContent,
  failover: buildFailoverContent,
  lanDhcp: buildLanDhcpContent,
  brLanStatic: buildBrLanStaticContent,
  appRoute: buildAppRouteContent,
  loadBalancing: buildLoadBalancingContent,
};

export function getDefaultForm(ttype = 'firewall') {
  const factory = DEFAULTS[ttype] || defaultFirewallForm;
  return factory(ttype);
}

const LEGACY_INTERFACE_TYPES = {
  lanDhcp: 'dhcpClient',
  brLanStatic: 'static',
  failover: 'wanFailover',
  vlan: 'vlan',
};

export function normalizeLoadedFormValue(data = {}) {
  const ttype = data.temp_type || data.ttype || 'firewall';
  const fv = data.content?.formValue || {};
  const legacyMode = LEGACY_INTERFACE_TYPES[ttype];

  if (!legacyMode) {
    return {
      ...getDefaultForm(ttype),
      ...fv,
      tempName: data.temp_name || fv.tempName || '',
      ttype,
    };
  }

  const interfaceMode = fv.interfaceMode || legacyMode;
  return {
    ...defaultInterfaceForm('interface'),
    ...interfaceDefaultsForMode(interfaceMode),
    ...fv,
    tempName: data.temp_name || fv.tempName || '',
    ttype: 'interface',
    interfaceMode,
  };
}

export function buildTemplateContent(ttype, formValue) {
  const builder = BUILDERS[ttype] || buildFirewallContent;
  return builder(formValue);
}

export function prepareTemplatePayload({ formValue, orgId, model }) {
  const ttype = formValue.ttype || 'firewall';
  const tempName = String(formValue.tempName || '').trim();
  const nameError = validateTemplateName(tempName);
  if (nameError) throw new Error(nameError);
  if (!model) throw new Error('Model is required');
  if (!orgId) throw new Error('Organization is required');

  const content = buildTemplateContent(ttype, {
    ...formValue,
    tempName,
    ttype,
  });

  return {
    temp_name: tempName,
    temp_type: ttype,
    orgId,
    model,
    desc: formValue.desc || '',
    content,
    formValue: {
      ...formValue,
      tempName,
      ttype,
    },
  };
}
