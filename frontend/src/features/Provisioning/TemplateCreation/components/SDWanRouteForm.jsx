import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS } from '../utils/templateOptions';

const blank = () => ({ fthres: '', prefix: '', iface1: '', metric1: '', hcheck1: '', iface2: '', metric2: '', hcheck2: '' });

export default function SDWanRouteForm({ value, onChange, lockedType = false }) {
  const updateList = (index, patch) => {
    const list = [...(value.routes || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, routes: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange}  lockedType={lockedType} />
      <div className="tpl-grid">
        <Field label="Interval (sec)"><TextInput type="number" value={value.interval ?? 60} onChange={(e) => onChange({ ...value, interval: e.target.value })} /></Field>
        <Field label="Enabled"><TextCheckbox label="Enable SD-WAN routing" checked={value.enabled !== false} onChange={(checked) => onChange({ ...value, enabled: checked })} /></Field>
      </div>
      <ArraySection
        title="SD-WAN Routes"
        items={value.routes || []}
        addLabel="Add route"
        onAdd={() => onChange({ ...value, routes: [...(value.routes || []), blank()] })}
        onRemove={(index) => onChange({ ...value, routes: (value.routes || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Fail Threshold"><TextInput value={item.fthres || ''} onChange={(e) => updateList(index, { fthres: e.target.value })} /></Field>
            <Field label="Prefix"><TextInput value={item.prefix || ''} onChange={(e) => updateList(index, { prefix: e.target.value })} /></Field>
            <Field label="Interface 1"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.iface1 || ''} onChange={(e) => updateList(index, { iface1: e.target.value })} /></Field>
            <Field label="Metric 1"><TextInput value={item.metric1 || ''} onChange={(e) => updateList(index, { metric1: e.target.value })} /></Field>
            <Field label="Healthcheck 1"><TextInput value={item.hcheck1 || ''} onChange={(e) => updateList(index, { hcheck1: e.target.value })} /></Field>
            <Field label="Interface 2"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.iface2 || ''} onChange={(e) => updateList(index, { iface2: e.target.value })} /></Field>
            <Field label="Metric 2"><TextInput value={item.metric2 || ''} onChange={(e) => updateList(index, { metric2: e.target.value })} /></Field>
            <Field label="Healthcheck 2"><TextInput value={item.hcheck2 || ''} onChange={(e) => updateList(index, { hcheck2: e.target.value })} /></Field>
          </>
        )}
      />
    </div>
  );
}
