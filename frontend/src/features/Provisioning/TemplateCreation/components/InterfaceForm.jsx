import React from 'react';
import { Field, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';
import { INTERFACE_MODES, interfaceDefaultsForMode } from '../utils/interfaceBuilder';
import LanDhcpForm from './LanDhcpForm';
import BrLanStaticForm from './BrLanStaticForm';
import FailoverForm from './FailoverForm';
import VlanForm from './VlanForm';

export default function InterfaceForm({ value, onChange, lockedType = false }) {
  const handleModeChange = (mode) => {
    onChange({
      tempName: value.tempName || '',
      ttype: 'interface',
      interfaceMode: mode,
      ...interfaceDefaultsForMode(mode),
    });
  };

  const mode = value.interfaceMode || '';

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={value} onChange={onChange} lockedType={lockedType} />
      <Field label="Interface type">
        <TextSelect
          value={mode}
          placeholder="Select interface type"
          options={INTERFACE_MODES}
          onChange={(e) => handleModeChange(e.target.value)}
        />
      </Field>
      {mode === 'dhcpClient' ? (
        <LanDhcpForm embedded value={value} onChange={onChange} />
      ) : null}
      {mode === 'static' ? (
        <BrLanStaticForm embedded value={value} onChange={onChange} />
      ) : null}
      {mode === 'wanFailover' ? (
        <FailoverForm embedded value={value} onChange={onChange} />
      ) : null}
      {mode === 'vlan' ? (
        <VlanForm embedded value={value} onChange={onChange} />
      ) : null}
    </div>
  );
}
