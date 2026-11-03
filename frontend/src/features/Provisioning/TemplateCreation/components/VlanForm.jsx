import React from 'react';
import { Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { ZONE_OPS } from '../utils/templateOptions';

export default function VlanForm({ value, onChange, lockedType = false, embedded = false }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className={embedded ? 'tpl-form-section' : 'tpl-form-stack'}>
      {!embedded ? (
        <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      ) : null}
      <div className="tpl-grid">
        <Field label="VLAN name"><TextInput value={value.vlanName || ''} placeholder="VLAN100" onChange={(e) => set({ vlanName: e.target.value })} /></Field>
        <Field label="VLAN ID"><TextInput value={value.vlanId || ''} placeholder="100" onChange={(e) => set({ vlanId: e.target.value })} /></Field>
        <Field label="Base device"><TextInput value={value.baseDevice || ''} placeholder="br-lan" onChange={(e) => set({ baseDevice: e.target.value })} /></Field>
        <Field label="Device name"><TextInput value={value.deviceName || ''} placeholder="br-lan.100" onChange={(e) => set({ deviceName: e.target.value })} /></Field>
        <Field label="IP address"><TextInput value={value.ipaddr || ''} onChange={(e) => set({ ipaddr: e.target.value })} /></Field>
        <Field label="Netmask"><TextInput value={value.netmask || ''} onChange={(e) => set({ netmask: e.target.value })} /></Field>
        <Field label="DHCP start"><TextInput value={value.dhcpStart || ''} onChange={(e) => set({ dhcpStart: e.target.value })} /></Field>
        <Field label="DHCP limit"><TextInput value={value.dhcpLimit || ''} onChange={(e) => set({ dhcpLimit: e.target.value })} /></Field>
        <Field label="Lease time"><TextInput value={value.leaseTime || ''} placeholder="12h" onChange={(e) => set({ leaseTime: e.target.value })} /></Field>
        <Field label="Bridge port"><TextInput value={value.bridgePort || ''} placeholder="lan:u*" onChange={(e) => set({ bridgePort: e.target.value })} /></Field>
        <Field label="Zone input"><TextSelect options={ZONE_OPS} value={value.zoneInput || 'ACCEPT'} onChange={(e) => set({ zoneInput: e.target.value })} /></Field>
        <Field label="Zone output"><TextSelect options={ZONE_OPS} value={value.zoneOutput || 'ACCEPT'} onChange={(e) => set({ zoneOutput: e.target.value })} /></Field>
        <Field label="Zone forward"><TextSelect options={ZONE_OPS} value={value.zoneForward || 'ACCEPT'} onChange={(e) => set({ zoneForward: e.target.value })} /></Field>
        <Field label="Firewall zone section"><TextInput value={value.firewallZoneSection || ''} placeholder="cfg06dc81" onChange={(e) => set({ firewallZoneSection: e.target.value })} /></Field>
        <Field label="Masquerading" full>
          <TextCheckbox label="Enable MASQ" checked={!!value.masq} onChange={(checked) => set({ masq: checked })} />
        </Field>
      </div>
    </div>
  );
}
