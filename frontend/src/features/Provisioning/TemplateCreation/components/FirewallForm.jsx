import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { DEVICE_OPTIONS, IP_FAMILY, PROTOCOL, ZONE_OPS } from '../utils/templateOptions';

const blankZone = () => ({ name: '', input: 'ACCEPT', output: 'ACCEPT', forward: 'REJECT', network: [], device: [], family: '', masq: false, out: [] });
const blankForward = () => ({ name: '', src: '', src_dport: '', dest: '', dest_ip: '', dest_port: '', proto: ['tcp'], reflection: false });
const blankRule = () => ({ name: '', src: '', dest: '', dest_port: '', proto: ['tcp'], target: 'ACCEPT', src_ip: '', dest_ip: '' });
const blankNat = () => ({ name: '', src: '', src_ip: '', dest_ip: '', snat_ip: '', proto: ['tcp'], action: 'ACCEPT' });

export default function FirewallForm({ value, onChange, lockedType = false }) {
  const zones = value.generalSettings?.zones || [];
  const setZones = (next) => onChange({ ...value, generalSettings: { ...(value.generalSettings || {}), zones: next } });
  const updateList = (key, index, patch) => {
    const list = [...(value[key] || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, [key]: list });
  };
  const addItem = (key, blank) => onChange({ ...value, [key]: [...(value[key] || []), blank] });
  const removeItem = (key, index) => onChange({ ...value, [key]: (value[key] || []).filter((_, i) => i !== index) });

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange}  lockedType={lockedType} />
      <Field label="Overwrite zones">
        <TextCheckbox label="Overwrite existing firewall zones" checked={!!value.overWriteZones} onChange={(checked) => onChange({ ...value, overWriteZones: checked })} />
      </Field>

      <ArraySection
        title="Zones"
        items={zones}
        addLabel="Add zone"
        onAdd={() => setZones([...zones, blankZone()])}
        onRemove={(index) => setZones(zones.filter((_, i) => i !== index))}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => { const next=[...zones]; next[index]={...item, name:e.target.value}; setZones(next); }} /></Field>
            <Field label="Input"><TextSelect options={ZONE_OPS} value={item.input || 'ACCEPT'} onChange={(e) => { const next=[...zones]; next[index]={...item, input:e.target.value}; setZones(next); }} /></Field>
            <Field label="Output"><TextSelect options={ZONE_OPS} value={item.output || 'ACCEPT'} onChange={(e) => { const next=[...zones]; next[index]={...item, output:e.target.value}; setZones(next); }} /></Field>
            <Field label="Forward"><TextSelect options={ZONE_OPS} value={item.forward || 'REJECT'} onChange={(e) => { const next=[...zones]; next[index]={...item, forward:e.target.value}; setZones(next); }} /></Field>
            <Field label="Networks (comma separated)"><TextInput value={(item.network || []).join(', ')} onChange={(e) => { const next=[...zones]; next[index]={...item, network:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}; setZones(next); }} /></Field>
            <Field label="Device"><TextSelect options={DEVICE_OPTIONS} placeholder="Select device" value={(item.device || [])[0] || ''} onChange={(e) => { const next=[...zones]; next[index]={...item, device:e.target.value ? [e.target.value] : []}; setZones(next); }} /></Field>
            <Field label="Family"><TextSelect options={IP_FAMILY} value={item.family || ''} onChange={(e) => { const next=[...zones]; next[index]={...item, family:e.target.value}; setZones(next); }} /></Field>
            <Field label="Forward to zones (comma separated)"><TextInput value={(item.out || []).join(', ')} onChange={(e) => { const next=[...zones]; next[index]={...item, out:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}; setZones(next); }} /></Field>
            <Field label="Masquerading"><TextCheckbox label="Enable MASQ" checked={!!item.masq} onChange={(checked) => { const next=[...zones]; next[index]={...item, masq:checked}; setZones(next); }} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Port Forwards"
        items={value.portForwards || []}
        addLabel="Add port forward"
        onAdd={() => addItem('portForwards', blankForward())}
        onRemove={(index) => removeItem('portForwards', index)}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('portForwards', index, { name: e.target.value })} /></Field>
            <Field label="Source zone"><TextInput value={item.src || ''} onChange={(e) => updateList('portForwards', index, { src: e.target.value })} /></Field>
            <Field label="External port"><TextInput value={item.src_dport || ''} onChange={(e) => updateList('portForwards', index, { src_dport: e.target.value })} /></Field>
            <Field label="Dest zone"><TextInput value={item.dest || ''} onChange={(e) => updateList('portForwards', index, { dest: e.target.value })} /></Field>
            <Field label="Internal IP"><TextInput value={item.dest_ip || ''} onChange={(e) => updateList('portForwards', index, { dest_ip: e.target.value })} /></Field>
            <Field label="Internal port"><TextInput value={item.dest_port || ''} onChange={(e) => updateList('portForwards', index, { dest_port: e.target.value })} /></Field>
            <Field label="Protocol"><TextSelect options={PROTOCOL} value={(item.proto || ['tcp'])[0]} onChange={(e) => updateList('portForwards', index, { proto: [e.target.value] })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Traffic Rules"
        items={value.trafficRules || []}
        addLabel="Add traffic rule"
        onAdd={() => addItem('trafficRules', blankRule())}
        onRemove={(index) => removeItem('trafficRules', index)}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('trafficRules', index, { name: e.target.value })} /></Field>
            <Field label="Source"><TextInput value={item.src || ''} onChange={(e) => updateList('trafficRules', index, { src: e.target.value })} /></Field>
            <Field label="Destination"><TextInput value={item.dest || ''} onChange={(e) => updateList('trafficRules', index, { dest: e.target.value })} /></Field>
            <Field label="Dest port"><TextInput value={item.dest_port || ''} onChange={(e) => updateList('trafficRules', index, { dest_port: e.target.value })} /></Field>
            <Field label="Target"><TextSelect options={ZONE_OPS} value={item.target || 'ACCEPT'} onChange={(e) => updateList('trafficRules', index, { target: e.target.value })} /></Field>
            <Field label="Protocol"><TextSelect options={PROTOCOL} value={(item.proto || ['tcp'])[0]} onChange={(e) => updateList('trafficRules', index, { proto: [e.target.value] })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="NAT Rules"
        items={value.natRules || []}
        addLabel="Add NAT rule"
        onAdd={() => addItem('natRules', blankNat())}
        onRemove={(index) => removeItem('natRules', index)}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('natRules', index, { name: e.target.value })} /></Field>
            <Field label="Outbound zone"><TextInput value={item.src || ''} onChange={(e) => updateList('natRules', index, { src: e.target.value })} /></Field>
            <Field label="Source IP"><TextInput value={item.src_ip || ''} onChange={(e) => updateList('natRules', index, { src_ip: e.target.value })} /></Field>
            <Field label="Dest IP"><TextInput value={item.dest_ip || ''} onChange={(e) => updateList('natRules', index, { dest_ip: e.target.value })} /></Field>
            <Field label="SNAT IP"><TextInput value={item.snat_ip || ''} onChange={(e) => updateList('natRules', index, { snat_ip: e.target.value })} /></Field>
            <Field label="Action"><TextSelect options={ZONE_OPS} value={item.action || 'ACCEPT'} onChange={(e) => updateList('natRules', index, { action: e.target.value })} /></Field>
          </>
        )}
      />
    </div>
  );
}
