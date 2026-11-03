import React from 'react';
import { Field, TextInput } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

export default function BrLanStaticForm({ value, onChange, lockedType = false, embedded = false }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className={embedded ? 'tpl-form-section' : 'tpl-form-stack'}>
      {!embedded ? (
        <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      ) : null}
      <div className="tpl-grid">
        <Field label="UCI section"><TextInput value={value.section || ''} placeholder="br_lan" onChange={(e) => set({ section: e.target.value })} /></Field>
        <Field label="Device"><TextInput value={value.device || ''} placeholder="br-lan" onChange={(e) => set({ device: e.target.value })} /></Field>
        <Field label="IP address"><TextInput value={value.ipaddr || ''} onChange={(e) => set({ ipaddr: e.target.value })} /></Field>
        <Field label="Netmask"><TextInput value={value.netmask || ''} onChange={(e) => set({ netmask: e.target.value })} /></Field>
        <Field label="Gateway" full><TextInput value={value.gateway || ''} onChange={(e) => set({ gateway: e.target.value })} /></Field>
      </div>
    </div>
  );
}
