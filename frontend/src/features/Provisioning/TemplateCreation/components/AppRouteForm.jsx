import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

const blankRoute = () => ({
  name: '',
  enable: true,
  protocol: 'All',
  sourceZone: '',
  sourceIP: '',
  sourcePort: '',
  destinationZone: '',
  destinationIP: '',
  destinationPort: '',
  action: 'accept',
});

export default function AppRouteForm({ value, onChange, lockedType = false }) {
  const update = (index, patch) => {
    const list = [...(value.appRoute || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, appRoute: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      <ArraySection
        title="App routes"
        items={value.appRoute || []}
        addLabel="Add app route"
        onAdd={() => onChange({ ...value, appRoute: [...(value.appRoute || []), blankRoute()] })}
        onRemove={(index) => onChange({ ...value, appRoute: (value.appRoute || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => update(index, { name: e.target.value })} /></Field>
            <Field label="Protocol">
              <TextSelect options={['All', 'TCP', 'UDP']} value={item.protocol || 'All'} onChange={(e) => update(index, { protocol: e.target.value })} />
            </Field>
            <Field label="Source zone"><TextInput value={item.sourceZone || ''} onChange={(e) => update(index, { sourceZone: e.target.value })} /></Field>
            <Field label="Source IP"><TextInput value={item.sourceIP || ''} onChange={(e) => update(index, { sourceIP: e.target.value })} /></Field>
            <Field label="Source port"><TextInput value={item.sourcePort || ''} onChange={(e) => update(index, { sourcePort: e.target.value })} /></Field>
            <Field label="Destination zone"><TextInput value={item.destinationZone || ''} onChange={(e) => update(index, { destinationZone: e.target.value })} /></Field>
            <Field label="Destination IP"><TextInput value={item.destinationIP || ''} onChange={(e) => update(index, { destinationIP: e.target.value })} /></Field>
            <Field label="Destination port"><TextInput value={item.destinationPort || ''} onChange={(e) => update(index, { destinationPort: e.target.value })} /></Field>
            <Field label="Action">
              <TextSelect
                options={[{ value: 'accept', title: 'Accept' }, { value: 'drop', title: 'Drop' }, { value: 'reject', title: 'Reject' }]}
                value={item.action || 'accept'}
                onChange={(e) => update(index, { action: e.target.value })}
              />
            </Field>
            <Field label="Enabled">
              <TextCheckbox label="Enable" checked={item.enable !== false} onChange={(checked) => update(index, { enable: checked })} />
            </Field>
          </>
        )}
      />
    </div>
  );
}
