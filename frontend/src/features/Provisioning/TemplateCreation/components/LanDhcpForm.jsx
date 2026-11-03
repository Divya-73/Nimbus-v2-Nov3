import React from 'react';
import { Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

export default function LanDhcpForm({ value, onChange, lockedType = false, embedded = false }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className={embedded ? 'tpl-form-section' : 'tpl-form-stack'}>
      {!embedded ? (
        <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      ) : null}
      <div className="tpl-grid">
        <Field label="Interface">
          <TextInput value={value.interfaceName || ''} placeholder="lan" onChange={(e) => set({ interfaceName: e.target.value })} />
        </Field>
        <Field label="RA preference">
          <TextSelect
            options={['low', 'medium', 'high']}
            placeholder="Select preference"
            value={value.raPreference || ''}
            onChange={(e) => set({ raPreference: e.target.value })}
          />
        </Field>
        <Field label="Options" full>
          <TextCheckbox
            label="Clear RA SLAAC"
            checked={value.clearRaSlaac !== false}
            onChange={(checked) => set({ clearRaSlaac: checked })}
          />
        </Field>
        <Field label=" " full>
          <TextCheckbox
            label="Clear static IP address"
            checked={value.clearIpaddr !== false}
            onChange={(checked) => set({ clearIpaddr: checked })}
          />
        </Field>
      </div>
    </div>
  );
}
