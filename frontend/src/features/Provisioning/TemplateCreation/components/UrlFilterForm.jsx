import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

const blankUrl = () => ({ name: '', url: '', action: 'block', enabled: true });

export default function UrlFilterForm({ value, onChange, lockedType = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const updateDomainList = (key, index, nextValue) => {
    const list = [...(value[key] || [])];
    list[index] = nextValue;
    set({ [key]: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      <div className="tpl-grid">
        <Field label="DNS service"><TextInput value={value.dnsService || ''} onChange={(e) => set({ dnsService: e.target.value })} /></Field>
        <Field label="Force DNS"><TextInput value={value.forceDns || ''} onChange={(e) => set({ forceDns: e.target.value })} /></Field>
        <Field label="DNSMASQ validity check">
          <TextSelect
            options={[{ value: '0', title: 'Disabled' }, { value: '1', title: 'Enabled' }]}
            value={value.dnsmasqValidityCheck || '0'}
            onChange={(e) => set({ dnsmasqValidityCheck: e.target.value })}
          />
        </Field>
        <Field label="Debug">
          <TextSelect
            options={[{ value: '0', title: 'Off' }, { value: '1', title: 'On' }]}
            value={value.debug || '0'}
            onChange={(e) => set({ debug: e.target.value })}
          />
        </Field>
        <Field label="Auto update" full>
          <TextCheckbox
            label="Enable config auto update"
            checked={!!value.configUpdateEnabled}
            onChange={(checked) => set({ configUpdateEnabled: checked })}
          />
        </Field>
      </div>

      <ArraySection
        title="Blocked domains"
        items={value.blockedDomains || []}
        addLabel="Add blocked domain"
        onAdd={() => set({ blockedDomains: [...(value.blockedDomains || []), ''] })}
        onRemove={(index) => set({ blockedDomains: (value.blockedDomains || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <Field label="Domain" full>
            <TextInput value={item || ''} placeholder="example.com" onChange={(e) => updateDomainList('blockedDomains', index, e.target.value)} />
          </Field>
        )}
      />

      <ArraySection
        title="Allowed domains"
        items={value.allowedDomains || []}
        addLabel="Add allowed domain"
        onAdd={() => set({ allowedDomains: [...(value.allowedDomains || []), ''] })}
        onRemove={(index) => set({ allowedDomains: (value.allowedDomains || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <Field label="Domain" full>
            <TextInput value={item || ''} placeholder="example.com" onChange={(e) => updateDomainList('allowedDomains', index, e.target.value)} />
          </Field>
        )}
      />

      <ArraySection
        title="List URLs"
        items={value.listUrls || []}
        addLabel="Add list URL"
        onAdd={() => set({ listUrls: [...(value.listUrls || []), blankUrl()] })}
        onRemove={(index) => set({ listUrls: (value.listUrls || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => {
              const list = [...(value.listUrls || [])];
              list[index] = { ...item, name: e.target.value };
              set({ listUrls: list });
            }} /></Field>
            <Field label="URL"><TextInput value={item.url || ''} onChange={(e) => {
              const list = [...(value.listUrls || [])];
              list[index] = { ...item, url: e.target.value };
              set({ listUrls: list });
            }} /></Field>
            <Field label="Action">
              <TextSelect
                options={[{ value: 'block', title: 'Block' }, { value: 'allow', title: 'Allow' }]}
                value={item.action || 'block'}
                onChange={(e) => {
                  const list = [...(value.listUrls || [])];
                  list[index] = { ...item, action: e.target.value };
                  set({ listUrls: list });
                }}
              />
            </Field>
            <Field label="Enabled">
              <TextCheckbox
                label="Enabled"
                checked={item.enabled !== false}
                onChange={(checked) => {
                  const list = [...(value.listUrls || [])];
                  list[index] = { ...item, enabled: checked };
                  set({ listUrls: list });
                }}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
