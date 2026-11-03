import React from 'react';
import { Field, TextCheckbox, TextInput } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

export default function SystemForm({ value, onChange, lockedType = false }) {
  const system = value.system || {};
  const ntp = value.ntp || {};
  const setSystem = (patch) => onChange({ ...value, system: { ...system, ...patch } });
  const setNtp = (patch) => onChange({ ...value, ntp: { ...ntp, ...patch } });

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={{ tempName: value.tempName, ttype: value.ttype }} onChange={(next) => onChange({ ...value, ...next })} lockedType={lockedType} />
      <h4 className="tpl-section-title">System</h4>
      <div className="tpl-grid">
        <Field label="Hostname"><TextInput value={system.hostname || ''} onChange={(e) => setSystem({ hostname: e.target.value })} /></Field>
        <Field label="Timezone"><TextInput value={system.zonename || 'Asia/Kolkata'} onChange={(e) => setSystem({ zonename: e.target.value })} /></Field>
        <Field label="Description" full><TextInput value={system.description || ''} onChange={(e) => setSystem({ description: e.target.value })} /></Field>
        <Field label="Notes" full><TextInput value={system.notes || ''} onChange={(e) => setSystem({ notes: e.target.value })} /></Field>
        <Field label="Log buffer size"><TextInput value={system.log_size || '64'} onChange={(e) => setSystem({ log_size: e.target.value })} /></Field>
        <Field label="Log file"><TextInput value={system.log_file || ''} onChange={(e) => setSystem({ log_file: e.target.value })} /></Field>
      </div>
      <h4 className="tpl-section-title">NTP</h4>
      <div className="tpl-grid">
        <Field label="NTP client"><TextCheckbox label="Enable NTP client" checked={ntp.enabled !== false} onChange={(checked) => setNtp({ enabled: checked })} /></Field>
        <Field label="NTP server"><TextCheckbox label="Provide NTP server" checked={!!ntp.enable_server} onChange={(checked) => setNtp({ enable_server: checked })} /></Field>
        <Field label="DHCP servers"><TextCheckbox label="Use DHCP advertised servers" checked={ntp.use_dhcp !== false} onChange={(checked) => setNtp({ use_dhcp: checked })} /></Field>
        <Field label="NTP candidates (comma separated)" full><TextInput value={(ntp.server || []).join(', ')} onChange={(e) => setNtp({ server: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
      </div>
    </div>
  );
}
