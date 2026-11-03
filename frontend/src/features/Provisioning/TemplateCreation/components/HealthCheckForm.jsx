import React from 'react';
import { ArraySection, Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_OPTIONS, LOG_LEVELS } from '../utils/templateOptions';

const blank = () => ({ name: '', enable: true, dev: '', ltype: '1', addr: '', port: '', interval: '', cnt: '', jtms: '', pkl: '', ltms: '', rssi: '', stype: '0', saddr: '', sport: '', sdur: '', ll: '6' });

export default function HealthCheckForm({ value, onChange, lockedType = false }) {
  const updateList = (index, patch) => {
    const list = [...(value.healthCheck || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ ...value, healthCheck: list });
  };

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange}  lockedType={lockedType} />
      <ArraySection
        title="Health Checks"
        items={value.healthCheck || []}
        addLabel="Add health check"
        onAdd={() => onChange({ ...value, healthCheck: [...(value.healthCheck || []), blank()] })}
        onRemove={(index) => onChange({ ...value, healthCheck: (value.healthCheck || []).filter((_, i) => i !== index) })}
        renderItem={(item, index) => (
          <>
            <Field label="Enabled"><TextCheckbox label="Enable" checked={item.enable !== false} onChange={(checked) => updateList(index, { enable: checked })} /></Field>
            <Field label="Name"><TextInput value={item.name || ''} onChange={(e) => updateList(index, { name: e.target.value })} /></Field>
            <Field label="Source Interface"><TextSelect options={INTERFACE_OPTIONS} placeholder="Select" value={item.dev || ''} onChange={(e) => updateList(index, { dev: e.target.value })} /></Field>
            <Field label="Link Test Type"><TextSelect options={[{value:'1',title:'Ping'},{value:'2',title:'TWAMP'}]} value={item.ltype || '1'} onChange={(e) => updateList(index, { ltype: e.target.value })} /></Field>
            <Field label="Link Host"><TextInput value={item.addr || ''} onChange={(e) => updateList(index, { addr: e.target.value })} /></Field>
            <Field label="Port"><TextInput value={item.port || ''} onChange={(e) => updateList(index, { port: e.target.value })} /></Field>
            <Field label="Interval"><TextInput value={item.interval || ''} onChange={(e) => updateList(index, { interval: e.target.value })} /></Field>
            <Field label="Count"><TextInput value={item.cnt || ''} onChange={(e) => updateList(index, { cnt: e.target.value })} /></Field>
            <Field label="Jitter ms"><TextInput value={item.jtms || ''} onChange={(e) => updateList(index, { jtms: e.target.value })} /></Field>
            <Field label="Packet Loss %"><TextInput value={item.pkl || ''} onChange={(e) => updateList(index, { pkl: e.target.value })} /></Field>
            <Field label="Latency ms"><TextInput value={item.ltms || ''} onChange={(e) => updateList(index, { ltms: e.target.value })} /></Field>
            <Field label="Speedtest Type"><TextSelect options={[{value:'0',title:'None'},{value:'1',title:'Speedtest'},{value:'2',title:'iPerf3'}]} value={item.stype || '0'} onChange={(e) => updateList(index, { stype: e.target.value })} /></Field>
            <Field label="Speedtest Host"><TextInput value={item.saddr || ''} onChange={(e) => updateList(index, { saddr: e.target.value })} /></Field>
            <Field label="Log Level"><TextSelect options={LOG_LEVELS} value={item.ll || '6'} onChange={(e) => updateList(index, { ll: e.target.value })} /></Field>
          </>
        )}
      />
    </div>
  );
}
