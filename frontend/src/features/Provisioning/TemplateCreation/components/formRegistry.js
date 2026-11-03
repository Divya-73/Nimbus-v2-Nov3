import FirewallForm from './FirewallForm';
import RouteForm from './RouteForm';
import HealthCheckForm from './HealthCheckForm';
import SDWanRouteForm from './SDWanRouteForm';
import QoServiceForm from './QoServiceForm';
import WirelessForm from './WirelessForm';
import SystemForm from './SystemForm';
import NimbusForm from './NimbusForm';
import UrlFilterForm from './UrlFilterForm';
import IpsecForm from './IpsecForm';
import InterfaceForm from './InterfaceForm';
import AppRouteForm from './AppRouteForm';
import LoadBalancingForm from './LoadBalancingForm';

const FORM_MAP = {
  firewall: FirewallForm,
  route: RouteForm,
  healthCheck: HealthCheckForm,
  SDWanRoute: SDWanRouteForm,
  QoService: QoServiceForm,
  wireless: WirelessForm,
  system: SystemForm,
  nimbus: NimbusForm,
  url_filter: UrlFilterForm,
  ipsec: IpsecForm,
  interface: InterfaceForm,
  appRoute: AppRouteForm,
  loadBalancing: LoadBalancingForm,
};

export function getTemplateFormComponent(ttype) {
  return FORM_MAP[ttype] || FirewallForm;
}
