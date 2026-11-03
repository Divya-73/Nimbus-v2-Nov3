import { commitOnlyContent } from './uci';
import { buildVlanContent } from './vlanBuilder';
import { buildFailoverContent } from './failoverBuilder';
import { buildLanDhcpContent } from './lanDhcpBuilder';
import { buildBrLanStaticContent } from './brLanStaticBuilder';

export const INTERFACE_MODES = [
  { value: 'dhcpClient', title: 'Interface DHCP Client' },
  { value: 'static', title: 'Static' },
  { value: 'wanFailover', title: 'WAN Failover' },
  { value: 'vlan', title: 'VLAN' },
];

export function defaultInterfaceForm(ttype = 'interface') {
  return {
    tempName: '',
    ttype,
    interfaceMode: '',
  };
}

export function interfaceDefaultsForMode(mode) {
  switch (mode) {
    case 'dhcpClient':
      return {
        interfaceName: '',
        raPreference: '',
        clearRaSlaac: false,
        clearIpaddr: false,
      };
    case 'static':
      return {
        section: '',
        device: '',
        ipaddr: '',
        netmask: '',
        gateway: '',
      };
    case 'wanFailover':
      return { interfaces: [] };
    case 'vlan':
      return {
        vlanName: '',
        vlanId: '',
        baseDevice: '',
        deviceName: '',
        ipaddr: '',
        netmask: '',
        dhcpStart: '',
        dhcpLimit: '',
        leaseTime: '',
        dhcpv4: 'server',
        zoneInput: 'ACCEPT',
        zoneOutput: 'ACCEPT',
        zoneForward: 'ACCEPT',
        masq: false,
        bridgePort: '',
        firewallZoneSection: '',
      };
    default:
      return {};
  }
}

export function buildInterfaceContent(formObj = {}) {
  switch (formObj.interfaceMode) {
    case 'dhcpClient':
      return buildLanDhcpContent(formObj);
    case 'static':
      return buildBrLanStaticContent(formObj);
    case 'wanFailover':
      return buildFailoverContent(formObj);
    case 'vlan':
      return buildVlanContent(formObj);
    default:
      return commitOnlyContent({ formValue: formObj });
  }
}
