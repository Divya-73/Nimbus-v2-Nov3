import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { DEVICE_OPTIONS, QOS_TARGETS } from '../utils/templateOptions';

const blankIface = () => ({ name: '', enable: true, device: '', classgroup: '', overhead: false, halfduplex: false, download: '', upload: '' });
const blankRule = () => ({ target: 'Normal', srchost: '', dsthost: '', proto: '', ports: '', connbytes: '', comment: '' });

export default function QoServiceForm({ value, onChange, lockedType = false }) {
  const update = (key, index, patch) => {
    const list = [...(value[key] || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, [key]: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={{ ...value, overWrite: value.overWriteIface }} onChange={(next) => onChange({ ...value, ...next, overWriteIface: next.overWrite })} lockedType={lockedType} />
      <div className="tpl-grid">
        <Field label="Overwrite interfaces"><TextCheckbox label="Overwrite QoS interfaces" checked={!!value.overWriteIface} onChange={(checked) => onChange({ ...value, overWriteIface: checked })} /></Field>
        <Field label="Overwrite rules"><TextCheckbox label="Overwrite classify rules" checked={!!value.overWriteRule} onChange={(checked) => onChange({ ...value, overWriteRule: checked })} /></Field>
      </div>

      <ArraySection
        title="QoS Interfaces"
        items={value.interfaces || []}
        addLabel="Add interface"
        onAdd={() => onChange({ ...value, interfaces: [...(value.interfaces || []), blankIface()] })}
        onRemove={(index) => onChange({ ...value, interfaces: (value.interfaces || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => update('interfaces', index, { name: e.target.value })} /></Field>
            <Field label="Enabled"><TextCheckbox label="Enable" checked={item.enable !== false} onChange={(checked) => update('interfaces', index, { enable: checked })} /></Field>
            <Field label="Device"><TextSelect options={DEVICE_OPTIONS} placeholder="Select device" value={item.device || ''} onChange={(e) => update('interfaces', index, { device: e.target.value })} /></Field>
            <Field label="Class group"><TextInput value={item.classgroup || ''} onChange={(e) => update('interfaces', index, { classgroup: e.target.value })} /></Field>
            <Field label="Download kbit/s"><TextInput value={item.download || ''} onChange={(e) => update('interfaces', index, { download: e.target.value })} /></Field>
            <Field label="Upload kbit/s"><TextInput value={item.upload || ''} onChange={(e) => update('interfaces', index, { upload: e.target.value })} /></Field>
            <Field label="Overhead"><TextCheckbox label="Calculate overhead" checked={!!item.overhead} onChange={(checked) => update('interfaces', index, { overhead: checked })} /></Field>
            <Field label="Half duplex"><TextCheckbox label="Half-duplex" checked={!!item.halfduplex} onChange={(checked) => update('interfaces', index, { halfduplex: checked })} /></Field>
          </>
        )}
      />

      <ArraySection
        title="Classification Rules"
        items={value.csfRules || []}
        addLabel="Add rule"
        onAdd={() => onChange({ ...value, csfRules: [...(value.csfRules || []), blankRule()] })}
        onRemove={(index) => onChange({ ...value, csfRules: (value.csfRules || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Target"><TextSelect options={QOS_TARGETS} value={item.target || 'Normal'} onChange={(e) => update('csfRules', index, { target: e.target.value })} /></Field>
            <Field label="Source host"><TextInput value={item.srchost || ''} onChange={(e) => update('csfRules', index, { srchost: e.target.value })} /></Field>
            <Field label="Destination host"><TextInput value={item.dsthost || ''} onChange={(e) => update('csfRules', index, { dsthost: e.target.value })} /></Field>
            <Field label="Protocol"><TextInput value={item.proto || ''} onChange={(e) => update('csfRules', index, { proto: e.target.value })} /></Field>
            <Field label="Ports"><TextInput value={item.ports || ''} onChange={(e) => update('csfRules', index, { ports: e.target.value })} /></Field>
            <Field label="Bytes"><TextInput value={item.connbytes || ''} onChange={(e) => update('csfRules', index, { connbytes: e.target.value })} /></Field>
            <Field label="Comment" full><TextInput value={item.comment || ''} onChange={(e) => update('csfRules', index, { comment: e.target.value })} /></Field>
          </>
        )}
      />
    </div>
  );
}
