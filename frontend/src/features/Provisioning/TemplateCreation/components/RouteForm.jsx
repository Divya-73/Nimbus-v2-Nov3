import React from 'react';
import { ArraySection, Field, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS } from '../utils/templateOptions';

const blankRoute = () => ({ interface: '', target: '', netmask: '', gateway: '', metric: '', mtu: 1500, type: 'unicast', table: '', source: '' });

export default function RouteForm({ value, onChange, lockedType = false }) {
  const updateList = (index, patch) => {
    const list = [...(value.routes || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, routes: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange}  lockedType={lockedType} />
      <ArraySection
        title="Static Routes"
        items={value.routes || []}
        addLabel="Add route"
        onAdd={() => onChange({ ...value, routes: [...(value.routes || []), blankRoute()] })}
        onRemove={(index) => onChange({ ...value, routes: (value.routes || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Interface"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select interface" value={item.interface || ''} onChange={(e) => updateList(index, { interface: e.target.value })} /></Field>
            <Field label="Target"><TextInput value={item.target || ''} onChange={(e) => updateList(index, { target: e.target.value })} /></Field>
            <Field label="Netmask"><TextInput value={item.netmask || ''} placeholder="255.255.255.0" onChange={(e) => updateList(index, { netmask: e.target.value })} /></Field>
            <Field label="Gateway"><TextInput value={item.gateway || ''} onChange={(e) => updateList(index, { gateway: e.target.value })} /></Field>
            <Field label="Metric"><TextInput value={item.metric || ''} onChange={(e) => updateList(index, { metric: e.target.value })} /></Field>
            <Field label="MTU"><TextInput type="number" value={item.mtu || 1500} onChange={(e) => updateList(index, { mtu: e.target.value })} /></Field>
            <Field label="Type"><TextInput value={item.type || 'unicast'} onChange={(e) => updateList(index, { type: e.target.value })} /></Field>
            <Field label="Table"><TextInput value={item.table || ''} onChange={(e) => updateList(index, { table: e.target.value })} /></Field>
            <Field label="Source"><TextInput value={item.source || ''} onChange={(e) => updateList(index, { source: e.target.value })} /></Field>
          </>
        )}
      />
    </div>
  );
}
