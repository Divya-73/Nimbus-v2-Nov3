import React from 'react';
import { Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import { TEMPLATE_TYPES } from '../utils/templateOptions';

export default function TemplateMetaFields({
  value,
  onChange,
  types = TEMPLATE_TYPES,
  lockedType = false,
}) {
  const set = (key, next) => onChange({ ...value, [key]: next });

  return (
    <div className="tpl-meta-block">
      <div className="tpl-grid">
        <Field label="Template Type">
          <TextSelect
            value={value.ttype || ''}
            disabled={lockedType}
            options={types}
            placeholder="Select type"
            onChange={(e) => set('ttype', e.target.value)}
          />
        </Field>
        <Field label="Template Name">
          <TextInput
            value={value.tempName || ''}
            placeholder="e.g. branch-firewall-default"
            onChange={(e) => set('tempName', e.target.value)}
          />
        </Field>
        {'overWrite' in value ? (
          <Field label="Options" full>
            <TextCheckbox
              label="Overwrite existing config"
              checked={value.overWrite}
              onChange={(checked) => set('overWrite', checked)}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
