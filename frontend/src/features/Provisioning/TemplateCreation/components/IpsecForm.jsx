import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS } from '../utils/templateOptions';

const ENC = ['des', '3des', 'aes', 'aes128', 'aes192', 'aes256'];
const HASH = [{ title: 'sha1', value: 'sha' }, 'sha256', 'sha384', 'sha512', 'md5'];
const DH = [
  { title: '2 (modp1024)', value: 'modp1024' },
  { title: '5 (modp1536)', value: 'modp1536' },
  { title: '14 (modp2048)', value: 'modp2048' },
  { title: '15 (modp3072)', value: 'modp3072' },
  { title: '16 (modp4096)', value: 'modp4096' },
];

const blankProposal = () => ({
  name: '',
  encryption_algorithm: 'aes128',
  hash_algorithm: 'sha',
  dh_group: 'modp1024',
  prf_algorithm: '',
});
const blankTunnel = () => ({
  name: '',
  local_subnet: '',
  remote_subnet: '',
  crypto_proposal: 'strong',
  startaction: 'start',
  lifetime: '3600',
  rekeytime: '',
  dpdaction: 'trap',
  closeaction: 'start',
  local_nat: '',
  if_id: '',
  priority: '',
  ipcomp: false,
  hw_offload: '',
});
const blankRemote = () => ({
  name: '',
  enabled: true,
  keyexchange: 'ikev1',
  authentication_method: 'psk',
  pre_shared_key: '',
  gateway: '',
  dpddelay: '30',
  dpdtimeout: '120',
  fragmentation: 'yes',
  mobike: false,
  local_iface: 'wan1',
  crypto_proposal: 'strong',
  tunnel: 'tunnel1',
  bypass: '',
  ike_mode: 'main',
});

export default function IpsecForm({ value, onChange, lockedType = false }) {
  const updateList = (key, index, patch) => {
    const list = [...(value[key] || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, [key]: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />

      <ArraySection
        title="Crypto proposals"
        items={value.cryptoProposals || []}
        addLabel="Add proposal"
        onAdd={() => onChange({ ...value, cryptoProposals: [...(value.cryptoProposals || []), blankProposal()] })}
        onRemove={(index) => onChange({ ...value, cryptoProposals: (value.cryptoProposals || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('cryptoProposals', index, { name: e.target.value })} /></Field>
            <Field label="Encryption"><TextSelect options={ENC} value={item.encryption_algorithm || 'aes128'} onChange={(e) => updateList('cryptoProposals', index, { encryption_algorithm: e.target.value })} /></Field>
            <Field label="Hash"><TextSelect options={HASH} value={item.hash_algorithm || 'sha'} onChange={(e) => updateList('cryptoProposals', index, { hash_algorithm: e.target.value })} /></Field>
            <Field label="DH group"><TextSelect options={DH} value={item.dh_group || 'modp1024'} onChange={(e) => updateList('cryptoProposals', index, { dh_group: e.target.value })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Tunnel networks"
        items={value.tunnelNetworks || []}
        addLabel="Add tunnel"
        onAdd={() => onChange({ ...value, tunnelNetworks: [...(value.tunnelNetworks || []), blankTunnel()] })}
        onRemove={(index) => onChange({ ...value, tunnelNetworks: (value.tunnelNetworks || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('tunnelNetworks', index, { name: e.target.value })} /></Field>
            <Field label="Local subnet"><TextInput value={item.local_subnet || ''} placeholder="192.168.100.0/24" onChange={(e) => updateList('tunnelNetworks', index, { local_subnet: e.target.value })} /></Field>
            <Field label="Remote subnet"><TextInput value={item.remote_subnet || ''} placeholder="192.168.1.0/24" onChange={(e) => updateList('tunnelNetworks', index, { remote_subnet: e.target.value })} /></Field>
            <Field label="Crypto proposal"><TextInput value={item.crypto_proposal || ''} onChange={(e) => updateList('tunnelNetworks', index, { crypto_proposal: e.target.value })} /></Field>
            <Field label="Lifetime"><TextInput value={item.lifetime || ''} onChange={(e) => updateList('tunnelNetworks', index, { lifetime: e.target.value })} /></Field>
            <Field label="Start action"><TextInput value={item.startaction || 'start'} onChange={(e) => updateList('tunnelNetworks', index, { startaction: e.target.value })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Remote endpoints"
        items={value.tunnelConfigs || []}
        addLabel="Add remote"
        onAdd={() => onChange({ ...value, tunnelConfigs: [...(value.tunnelConfigs || []), blankRemote()] })}
        onRemove={(index) => onChange({ ...value, tunnelConfigs: (value.tunnelConfigs || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('tunnelConfigs', index, { name: e.target.value })} /></Field>
            <Field label="Gateway"><TextInput value={item.gateway || ''} onChange={(e) => updateList('tunnelConfigs', index, { gateway: e.target.value })} /></Field>
            <Field label="PSK"><TextInput value={item.pre_shared_key || ''} onChange={(e) => updateList('tunnelConfigs', index, { pre_shared_key: e.target.value })} /></Field>
            <Field label="Local interface"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.local_iface || ''} onChange={(e) => updateList('tunnelConfigs', index, { local_iface: e.target.value })} /></Field>
            <Field label="Key exchange"><TextSelect options={[{ value: 'ikev1', title: 'IKEv1' }, { value: 'ikev2', title: 'IKEv2' }]} value={item.keyexchange || 'ikev1'} onChange={(e) => updateList('tunnelConfigs', index, { keyexchange: e.target.value })} /></Field>
            <Field label="Tunnel"><TextInput value={item.tunnel || ''} onChange={(e) => updateList('tunnelConfigs', index, { tunnel: e.target.value })} /></Field>
            <Field label="Crypto proposal"><TextInput value={item.crypto_proposal || ''} onChange={(e) => updateList('tunnelConfigs', index, { crypto_proposal: e.target.value })} /></Field>
            <Field label="Enabled"><TextCheckbox label="Enabled" checked={item.enabled !== false} onChange={(checked) => updateList('tunnelConfigs', index, { enabled: checked })} /></Field>
          </>
        )}
      />
    </div>
  );
}
