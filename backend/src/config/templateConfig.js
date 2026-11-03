/**
 * Centralized template type list for backend validation and type APIs.
 */

export const TEMPLATE_TYPE_NAME = 'System';

export const TEMPLATE_TYPES = [
  { value: 'firewall', title: 'Firewall', label: 'Firewall' },
  { value: 'QoService', title: 'Quality of Service', label: 'Quality of Service' },
  { value: 'SDWanRoute', title: 'SD-WAN Route', label: 'SD-WAN Route' },
  { value: 'route', title: 'Routing', label: 'Routing' },
  { value: 'healthCheck', title: 'Health Check', label: 'Health Check' },
  { value: 'wireless', title: 'Wireless', label: 'Wireless' },
  { value: 'system', title: 'System', label: 'System' },
  { value: 'nimbus', title: 'Nimbus', label: 'Nimbus' },
  { value: 'url_filter', title: 'URL Filtering', label: 'URL Filtering' },
  { value: 'ipsec', title: 'IPSec', label: 'IPSec' },
  { value: 'interface', title: 'Interfaces', label: 'Interfaces' },
  { value: 'appRoute', title: 'App Route', label: 'App Route' },
  { value: 'loadBalancing', title: 'Load Balancing', label: 'Load Balancing' },
];

const LEGACY_TEMPLATE_TYPES = [
  { value: 'vlan', title: 'VLAN', label: 'VLAN' },
  { value: 'failover', title: 'WAN Failover', label: 'WAN Failover' },
  { value: 'lanDhcp', title: 'LAN DHCP Client', label: 'LAN DHCP Client' },
  { value: 'brLanStatic', title: 'BR-LAN Static', label: 'BR-LAN Static' },
];

export function getValidTemplateTypeValues() {
  return [...TEMPLATE_TYPES, ...LEGACY_TEMPLATE_TYPES].map((type) => type.value);
}

export function isValidTemplateType(value) {
  return getValidTemplateTypeValues().includes(value);
}
