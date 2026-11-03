import React from 'react';
import { Field, TextCheckbox, TextInput, TextSelect } from './FormControls';
import TemplateMetaFields from './TemplateMetaFields';

export default function WirelessForm({ value, onChange, lockedType = false }) {
  const wifi = value.wifi || {};
  const setWifi = (patch) => onChange({ ...value, wifi: { ...wifi, ...patch } });

  return (
    <div className="tpl-form-stack">
      <TemplateMetaFields value={{ tempName: value.tempName, ttype: value.ttype }} onChange={(next) => onChange({ ...value, ...next })} lockedType={lockedType} />
      <div className="tpl-grid">
        <Field label="Band"><TextSelect options={[{value:'2g',title:'2.4 GHz'},{value:'5g',title:'5 GHz'}]} value={wifi.rangeType || '2g'} onChange={(e) => setWifi({ rangeType: e.target.value })} /></Field>
        <Field label="SSID"><TextInput value={wifi.ssid || ''} onChange={(e) => setWifi({ ssid: e.target.value })} /></Field>
        <Field label="Encryption"><TextSelect options={[{value:'psk2',title:'WPA2-PSK'},{value:'psk-mixed',title:'WPA/WPA2'},{value:'sae',title:'WPA3'},{value:'none',title:'Open'}]} value={wifi.encryption || 'psk2'} onChange={(e) => setWifi({ encryption: e.target.value })} /></Field>
        <Field label="Key / Password"><TextInput type="password" value={wifi.key || ''} onChange={(e) => setWifi({ key: e.target.value })} /></Field>
        <Field label="Channel"><TextInput value={wifi.channel || 'auto'} onChange={(e) => setWifi({ channel: e.target.value })} /></Field>
        <Field label="HT Mode"><TextSelect options={['HT20','HT40','HT80','HT160']} value={wifi.htmode || 'HT20'} onChange={(e) => setWifi({ htmode: e.target.value })} /></Field>
        <Field label="TX Power"><TextInput value={wifi.txpower || '20'} onChange={(e) => setWifi({ txpower: e.target.value })} /></Field>
        <Field label="Country"><TextInput value={wifi.country || 'IN'} onChange={(e) => setWifi({ country: e.target.value })} /></Field>
        <Field label="Hidden SSID"><TextCheckbox label="Hide SSID" checked={!!wifi.hidden} onChange={(checked) => setWifi({ hidden: checked })} /></Field>
        <Field label="Radio"><TextCheckbox label="Disable radio" checked={!!wifi.disabled} onChange={(checked) => setWifi({ disabled: checked })} /></Field>
      </div>
    </div>
  );
}
