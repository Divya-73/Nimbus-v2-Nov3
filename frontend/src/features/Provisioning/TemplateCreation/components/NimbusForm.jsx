import React from 'react';
import { Field, TextCheckbox, TextInput } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

export default function NimbusForm({ value, onChange, lockedType = false }) {
  const nmc = value.aheesaNMC || {};
  const fm = value.aheesaFM || {};
  const setNmc = (patch) => onChange({ ...value, aheesaNMC: { ...nmc, ...patch } });
  const setFm = (patch) => onChange({ ...value, aheesaFM: { ...fm, ...patch } });

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={{ tempName: value.tempName, ttype: value.ttype }} onChange={(next) => onChange({ ...value, ...next })} lockedType={lockedType} />

      <h4 className="tpl-section-title">Nimbus Agent</h4>
      <div className="tpl-grid">
        <Field label="Enabled"><TextCheckbox label="Enable Nimbus" checked={nmc.enabled !== false} onChange={(checked) => setNmc({ enabled: checked })} /></Field>
        <Field label="Agent Id"><TextInput value={nmc.agentId || ''} onChange={(e) => setNmc({ agentId: e.target.value })} /></Field>
        <Field label="Org Id"><TextInput value={nmc.orgId || ''} onChange={(e) => setNmc({ orgId: e.target.value })} /></Field>
        <Field label="Branch Id"><TextInput value={nmc.branchId || ''} onChange={(e) => setNmc({ branchId: e.target.value })} /></Field>
        <Field label="Tags"><TextInput value={nmc.tags || ''} onChange={(e) => setNmc({ tags: e.target.value })} /></Field>
        <Field label="NDE Server"><TextInput value={nmc.esrv || ''} onChange={(e) => setNmc({ esrv: e.target.value })} /></Field>
        <Field label="NDE User:Pass"><TextInput type="password" value={nmc.eusrpwd || ''} onChange={(e) => setNmc({ eusrpwd: e.target.value })} /></Field>
        <Field label="NME Server"><TextInput value={nmc.msrv || ''} onChange={(e) => setNmc({ msrv: e.target.value })} /></Field>
        <Field label="NME Port"><TextInput value={nmc.mport || ''} onChange={(e) => setNmc({ mport: e.target.value })} /></Field>
        <Field label="NME User"><TextInput value={nmc.muser || ''} onChange={(e) => setNmc({ muser: e.target.value })} /></Field>
        <Field label="NME Password"><TextInput type="password" value={nmc.mpass || ''} onChange={(e) => setNmc({ mpass: e.target.value })} /></Field>
        <Field label="Topic Prefix"><TextInput value={nmc.mtopic || ''} onChange={(e) => setNmc({ mtopic: e.target.value })} /></Field>
        <Field label="Interval"><TextInput value={nmc.sf || ''} onChange={(e) => setNmc({ sf: e.target.value })} /></Field>
        <Field label="System"><TextCheckbox label="System/CPU/Memory" checked={!!nmc.flsys} onChange={(checked) => setNmc({ flsys: checked })} /></Field>
        <Field label="Network"><TextCheckbox label="Network metrics" checked={!!nmc.flnet} onChange={(checked) => setNmc({ flnet: checked })} /></Field>
        <Field label="LTE"><TextCheckbox label="LTE details" checked={!!nmc.fllte} onChange={(checked) => setNmc({ fllte: checked })} /></Field>
        <Field label="Health"><TextCheckbox label="Health check" checked={!!nmc.flhk} onChange={(checked) => setNmc({ flhk: checked })} /></Field>
      </div>

      <h4 className="tpl-section-title">Flow Monitor</h4>
      <div className="tpl-grid">
        <Field label="Enabled"><TextCheckbox label="Enable Flow Monitor" checked={fm.enabled !== false} onChange={(checked) => setFm({ enabled: checked })} /></Field>
        <Field label="Agent Id"><TextInput value={fm.agentId || ''} onChange={(e) => setFm({ agentId: e.target.value })} /></Field>
        <Field label="Org Id"><TextInput value={fm.orgId || ''} onChange={(e) => setFm({ orgId: e.target.value })} /></Field>
        <Field label="Branch Id"><TextInput value={fm.branchId || ''} onChange={(e) => setFm({ branchId: e.target.value })} /></Field>
        <Field label="Tags"><TextInput value={fm.tags || ''} onChange={(e) => setFm({ tags: e.target.value })} /></Field>
        <Field label="Flow Monitor"><TextInput value={fm.esrv || ''} onChange={(e) => setFm({ esrv: e.target.value })} /></Field>
        <Field label="User:Pass"><TextInput type="password" value={fm.eusrpwd || ''} onChange={(e) => setFm({ eusrpwd: e.target.value })} /></Field>
        <Field label="Interfaces (comma separated)" full><TextInput value={(fm.iface || []).join(', ')} onChange={(e) => setFm({ iface: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
      </div>
    </div>
  );
}
