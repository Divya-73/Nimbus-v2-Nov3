export const TEMPLATE_TYPES = [
  { value: 'firewall', title: 'Firewall', label: 'Firewall', tone: 'rose' },
  { value: 'QoService', title: 'Quality of Service', label: 'Quality of Service', tone: 'amber' },
  { value: 'SDWanRoute', title: 'SD-WAN Route', label: 'SD-WAN Route', tone: 'sky' },
  { value: 'route', title: 'Routing', label: 'Routing', tone: 'violet' },
  { value: 'healthCheck', title: 'Health Check', label: 'Health Check / SpeedTest', tone: 'emerald' },
  { value: 'wireless', title: 'Wireless', label: 'Wireless', tone: 'cyan' },
  { value: 'system', title: 'System', label: 'System', tone: 'slate' },
  { value: 'nimbus', title: 'Nimbus', label: 'Nimbus', tone: 'teal' },
  { value: 'url_filter', title: 'URL Filtering', label: 'URL Filtering', tone: 'rose' },
  { value: 'ipsec', title: 'IPSec', label: 'IPSec', tone: 'sky' },
  { value: 'interface', title: 'Interfaces', label: 'Interfaces', tone: 'violet' },
  { value: 'appRoute', title: 'App Route', label: 'App Route', tone: 'slate' },
  { value: 'loadBalancing', title: 'Load Balancing', label: 'Load Balancing', tone: 'teal' },
];

const LEGACY_TEMPLATE_TYPES = {
  vlan: { label: 'Interfaces · VLAN', tone: 'violet' },
  failover: { label: 'Interfaces · WAN Failover', tone: 'amber' },
  lanDhcp: { label: 'Interfaces · DHCP Client', tone: 'emerald' },
  brLanStatic: { label: 'Interfaces · Static', tone: 'cyan' },
};

export function getTemplateTypeMeta(value) {
  const found = TEMPLATE_TYPES.find((t) => t.value === value);
  if (found) return found;
  const legacy = LEGACY_TEMPLATE_TYPES[value];
  if (legacy) return { value, title: legacy.label, ...legacy };
  return null;
}

export const PROTOCOL = [
  { title: 'ANY', value: 'all' },
  { title: 'UDP', value: 'udp' },
  { title: 'TCP', value: 'tcp' },
  { title: 'ICMP', value: 'icmp' },
];

export const INTERFACE_OPTIONS = [
  'LTE1', 'LTE2', 'wan', 'lan', 'sstp-SSTP_Out1',
  'wan6', 'wan1', 'wan16', 'loop',
];

export const DEVICE_OPTIONS = [
  'eth0', 'eth1', 'eth2', 'eth4', 'eth5',
  'LTE1', 'LTE2', 'br-lan', 'SSTP_Out1',
];

export const IP_FAMILY = [
  { title: 'IPv4 and IPv6', value: '' },
  { title: 'IPv4 only', value: 'ipv4' },
  { title: 'IPv6 only', value: 'ipv6' },
];

export const ZONE_OPS = ['ACCEPT', 'REJECT', 'DROP'];

export const QOS_TARGETS = ['Normal', 'Priority', 'Express', 'Bulk'];

export const LOG_LEVELS = [
  { value: '0', title: 'Emergency' },
  { value: '1', title: 'Alert' },
  { value: '2', title: 'Critical' },
  { value: '3', title: 'Error' },
  { value: '4', title: 'Warning' },
  { value: '5', title: 'Notice' },
  { value: '6', title: 'Information' },
  { value: '7', title: 'Debug' },
];

