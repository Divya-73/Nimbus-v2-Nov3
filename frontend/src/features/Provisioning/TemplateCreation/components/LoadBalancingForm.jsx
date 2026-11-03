import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS } from '../utils/templateOptions';

const MWAN_LOG_LEVELS = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];

const blankIface = () => ({
  name: '',
  enabled: true,
  initial: 'online',
  internet: 'IPv4',
  trackingHostname: '',
  reliability: '1',
  count: '1',
  timeout: '2',
  interval: '5',
  down: '5',
  up: '5',
});
const blankMember = () => ({ name: '', interface: '', metric: '1', weight: '1' });
const blankPolicy = () => ({ name: '', use_member: '', last_resort: 'unreachable' });
const blankRule = () => ({
  name: '',
  proto: 'all',
  src_ip: '',
  src_port: '',
  dest_ip: '',
  dest_port: '',
  use_policy: '',
  sticky: false,
});

export default function LoadBalancingForm({ value, onChange, lockedType = false }) {
  const globals = value.globals || {};
  const setGlobals = (patch) => onChange({ ...value, globals: { ...globals, ...patch } });
  const updateList = (key, index, patch) => {
    const list = [...(value[key] || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, [key]: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      <div className="tpl-grid">
        <Field label="Overwrite interfaces"><TextCheckbox label="Overwrite mwan3 interfaces" checked={!!value.overWriteIface} onChange={(checked) => onChange({ ...value, overWriteIface: checked })} /></Field>
        <Field label="Overwrite members"><TextCheckbox label="Overwrite mwan3 members" checked={!!value.overWriteMember} onChange={(checked) => onChange({ ...value, overWriteMember: checked })} /></Field>
        <Field label="Overwrite policies"><TextCheckbox label="Overwrite mwan3 policies" checked={!!value.overWritePolicy} onChange={(checked) => onChange({ ...value, overWritePolicy: checked })} /></Field>
        <Field label="Overwrite rules"><TextCheckbox label="Overwrite mwan3 rules" checked={!!value.overWriteRule} onChange={(checked) => onChange({ ...value, overWriteRule: checked })} /></Field>
        <Field label="Firewall mask"><TextInput value={globals.mmx_mask || ''} onChange={(e) => setGlobals({ mmx_mask: e.target.value })} /></Field>
        <Field label="Log level"><TextSelect options={MWAN_LOG_LEVELS} value={globals.loglevel || 'notice'} onChange={(e) => setGlobals({ loglevel: e.target.value })} /></Field>
        <Field label="Update interval"><TextInput value={globals.rtmon_interval || ''} onChange={(e) => setGlobals({ rtmon_interval: e.target.value })} /></Field>
        <Field label="Logging"><TextCheckbox label="Enable logging" checked={!!globals.logging} onChange={(checked) => setGlobals({ logging: checked })} /></Field>
      </div>

      <ArraySection
        title="WAN interfaces"
        items={value.interfaces || []}
        addLabel="Add interface"
        onAdd={() => onChange({ ...value, interfaces: [...(value.interfaces || []), blankIface()] })}
        onRemove={(index) => onChange({ ...value, interfaces: (value.interfaces || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.name || ''} onChange={(e) => updateList('interfaces', index, { name: e.target.value })} /></Field>
            <Field label="Track hosts"><TextInput value={item.trackingHostname || ''} placeholder="8.8.8.8, 1.1.1.1" onChange={(e) => updateList('interfaces', index, { trackingHostname: e.target.value })} /></Field>
            <Field label="Initial"><TextSelect options={['online', 'offline']} value={item.initial || 'online'} onChange={(e) => updateList('interfaces', index, { initial: e.target.value })} /></Field>
            <Field label="Family"><TextSelect options={['IPv4', 'IPv6']} value={item.internet || 'IPv4'} onChange={(e) => updateList('interfaces', index, { internet: e.target.value })} /></Field>
            <Field label="Enabled"><TextCheckbox label="Enabled" checked={item.enabled !== false} onChange={(checked) => updateList('interfaces', index, { enabled: checked })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Members"
        items={value.members || []}
        addLabel="Add member"
        onAdd={() => onChange({ ...value, members: [...(value.members || []), blankMember()] })}
        onRemove={(index) => onChange({ ...value, members: (value.members || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('members', index, { name: e.target.value })} /></Field>
            <Field label="Interface"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.interface || ''} onChange={(e) => updateList('members', index, { interface: e.target.value })} /></Field>
            <Field label="Metric"><TextInput value={item.metric || ''} onChange={(e) => updateList('members', index, { metric: e.target.value })} /></Field>
            <Field label="Weight"><TextInput value={item.weight || ''} onChange={(e) => updateList('members', index, { weight: e.target.value })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Policies"
        items={value.policies || []}
        addLabel="Add policy"
        onAdd={() => onChange({ ...value, policies: [...(value.policies || []), blankPolicy()] })}
        onRemove={(index) => onChange({ ...value, policies: (value.policies || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('policies', index, { name: e.target.value })} /></Field>
            <Field label="Members"><TextInput value={item.use_member || ''} placeholder="member1, member2" onChange={(e) => updateList('policies', index, { use_member: e.target.value })} /></Field>
            <Field label="Last resort"><TextInput value={item.last_resort || ''} onChange={(e) => updateList('policies', index, { last_resort: e.target.value })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Rules"
        items={value.rules || []}
        addLabel="Add rule"
        onAdd={() => onChange({ ...value, rules: [...(value.rules || []), blankRule()] })}
        onRemove={(index) => onChange({ ...value, rules: (value.rules || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList('rules', index, { name: e.target.value })} /></Field>
            <Field label="Policy"><TextInput value={item.use_policy || ''} onChange={(e) => updateList('rules', index, { use_policy: e.target.value })} /></Field>
            <Field label="Source IP"><TextInput value={item.src_ip || ''} onChange={(e) => updateList('rules', index, { src_ip: e.target.value })} /></Field>
            <Field label="Dest IP"><TextInput value={item.dest_ip || ''} onChange={(e) => updateList('rules', index, { dest_ip: e.target.value })} /></Field>
            <Field label="Proto"><TextInput value={item.proto || 'all'} onChange={(e) => updateList('rules', index, { proto: e.target.value })} /></Field>
            <Field label="Sticky"><TextCheckbox label="Sticky" checked={!!item.sticky} onChange={(checked) => updateList('rules', index, { sticky: checked })} /></Field>
          </>
        )}
      />
    </div>
  );
}
