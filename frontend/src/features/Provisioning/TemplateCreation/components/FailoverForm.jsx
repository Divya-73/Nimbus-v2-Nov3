import React from 'react';
import { ArraySection, Field, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS } from '../utils/templateOptions';

const blankIface = () => ({ name: '', metric: '1' });

export default function FailoverForm({ value, onChange, lockedType = false, embedded = false }) {
  const update = (index, patch) => {
    const list = [...(value.interfaces || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, interfaces: list });
  };

  return (
    <div className={embedded ? 'tpl-form-section' : 'tpl-form-stack'}>
      {!embedded ? (
        <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      ) : null}
      <ArraySection
        title="WAN metric preference"
        items={value.interfaces || []}
        addLabel="Add interface"
        onAdd={() => onChange({ ...value, interfaces: [...(value.interfaces || []), blankIface()] })}
        onRemove={(index) => onChange({ ...value, interfaces: (value.interfaces || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Interface">
              <TextSelect
                options={INTERFACE_OPTIONS}
                placeholder="Select interface"
                value={item.name || ''}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </Field>
            <Field label="Metric">
              <TextInput value={item.metric || ''} onChange={(e) => update(index, { metric: e.target.value })} />
            </Field>
          </>
        )}
      />
    </div>
  );
}
