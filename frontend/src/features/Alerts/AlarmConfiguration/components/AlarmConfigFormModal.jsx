import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Radio, Router, Signal, X } from 'lucide-react';
import {
  EMPTY_POLICY,
  LTE_LIST,
  OBJECT_LEVELS,
  SEVERITY_LEVELS,
  policyFromApi,
  policyToPayload,
  toBool,
} from '../policyForm';
import AlarmConfigDevicePicker from './AlarmConfigDevicePicker';

const TABS = [
  { id: 'deviceStatus', label: 'Device Status', Icon: Router },
  { id: 'deviceHealth', label: 'Device Health', Icon: Activity },
  { id: 'linkStatus', label: 'Link Status', Icon: Radio },
  { id: 'lteHealth', label: 'LTE Health', Icon: Signal },
  { id: 'notify', label: 'Notifications', Icon: Bell },
];

function Switch({ checked, disabled, title, onChange }) {
  return (
    <label className="ac-switch" title={title}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ac-switch__track" aria-hidden />
    </label>
  );
}

function SelectField({ label, value, disabled, options, onChange }) {
  return (
    <label className="dl-field">
      <span className="dl-field__label">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, disabled, placeholder, onChange }) {
  return (
    <label className="dl-field">
      <span className="dl-field__label">{label}</span>
      <input
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function AlarmConfigFormModal({
  mode,
  initial,
  lockedDeviceIds,
  hideDevicePicker = false,
  lockedDeviceLabel = '',
  isSuperAdmin = false,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_POLICY);
  const [activeTab, setActiveTab] = useState('deviceStatus');
  const isEdit = mode === 'edit';
  const lockedKey = (Array.isArray(lockedDeviceIds) ? lockedDeviceIds : [])
    .map(String)
    .filter(Boolean)
    .join(',');
  const lockedSet = useMemo(
    () => new Set(lockedKey ? lockedKey.split(',') : []),
    [lockedKey]
  );

  useEffect(() => {
    const next = policyFromApi(initial || EMPTY_POLICY);
    const include = new Set((next.include || []).map(String));
    lockedSet.forEach((id) => include.add(id));
    setForm({ ...next, include: Array.from(include) });
    setActiveTab('deviceStatus');
  }, [initial, mode, lockedSet]);

  const selectedIds = Array.isArray(form.include) ? form.include : [];

  function patch(path, value) {
    setForm((prev) => {
      const next = { ...prev };
      let ref = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        ref[key] = { ...(ref[key] || {}) };
        ref = ref[key];
      }
      ref[path[path.length - 1]] = value;
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const include = new Set((form.include || []).map(String));
    lockedSet.forEach((id) => include.add(id));
    onSubmit(policyToPayload({ ...form, include: Array.from(include) }));
  }

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="ac-form-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={saving} />
      <div className={`dl-gui-modal__card om-modal__card ac-modal${hideDevicePicker ? '' : ' ac-modal--picker'}`}>
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="ac-form-title" className="dl-gui-modal__title">
              {isEdit ? 'Edit alarm policy' : 'New alarm policy'}
            </h3>
            <p className="dl-gui-modal__sub">
              Choose devices, then enable the conditions that should raise an alarm.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form ac-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Policy name</span>
            <input
              value={form.policy_name}
              onChange={(e) => patch(['policy_name'], e.target.value)}
              placeholder="Policy name"
              disabled={saving}
              required
              autoFocus
            />
          </label>

          <div className="dl-field ac-enable-field">
            <span className="dl-field__label">Policy enabled</span>
            <div className="ac-enable-row">
              <Switch
                checked={toBool(form.enpolicy)}
                disabled={saving}
                title="Enable this policy"
                onChange={(checked) => patch(['enpolicy'], checked ? 1 : 0)}
              />
              <span className="ac-enable-label">{toBool(form.enpolicy) ? 'On' : 'Off'}</span>
            </div>
          </div>

          <div className="om-form__full">
            <div className="ac-device-head">
              <div>
                <h3 className="dash-panel__title">Devices</h3>
                <p className="dash-panel__meta">
                  {hideDevicePicker
                    ? `Applies to ${lockedDeviceLabel || 'this device'}`
                    : `${selectedIds.length.toLocaleString()} selected. Search and page through assigned CPEs — never load the full inventory.`}
                </p>
              </div>
            </div>

            {hideDevicePicker ? null : (
              <AlarmConfigDevicePicker
                selectedIds={form.include}
                lockedIds={lockedKey ? lockedKey.split(',') : []}
                disabled={saving}
                isSuperAdmin={isSuperAdmin}
                onChange={(ids) => setForm((prev) => ({ ...prev, include: ids }))}
              />
            )}
          </div>

          <div className="om-form__full ac-tabs-wrap">
            <div className="dd-tabs" role="tablist" aria-label="Alarm rule sections">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  className={`dd-tab${activeTab === id ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'deviceStatus' ? (
              <section className="ac-card">
                <header className="ac-card__head">
                  <div>
                    <h4 className="ac-card__title">Device Status</h4>
                    <p className="ac-card__sub">Raise an alarm when selected devices are DOWN</p>
                  </div>
                  <Switch
                    checked={toBool(form.dev_status.status)}
                    disabled={saving}
                    title="Enable device status alarms"
                    onChange={(checked) => patch(['dev_status', 'status'], checked ? 1 : 0)}
                  />
                </header>
                <div className="ac-fields ac-fields--2">
                  <SelectField
                    label="Alarm object type"
                    value={form.dev_status.olevel}
                    disabled={saving}
                    options={OBJECT_LEVELS}
                    onChange={(value) => patch(['dev_status', 'olevel'], value)}
                  />
                  <SelectField
                    label="Severity"
                    value={form.dev_status.slevel}
                    disabled={saving}
                    options={SEVERITY_LEVELS}
                    onChange={(value) => patch(['dev_status', 'slevel'], value)}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === 'deviceHealth' ? (
              <section className="ac-card">
                <header className="ac-card__head">
                  <div>
                    <h4 className="ac-card__title">Device Health</h4>
                    <p className="ac-card__sub">CPU, memory, and WAN throughput thresholds</p>
                  </div>
                  <Switch
                    checked={toBool(form.dev_health.status)}
                    disabled={saving}
                    title="Enable device health alarms"
                    onChange={(checked) => patch(['dev_health', 'status'], checked ? 1 : 0)}
                  />
                </header>
                <div className="ac-fields ac-fields--4">
                  <SelectField
                    label="Alarm object type"
                    value={form.dev_health.olevel}
                    disabled={saving}
                    options={OBJECT_LEVELS}
                    onChange={(value) => patch(['dev_health', 'olevel'], value)}
                  />
                  <SelectField
                    label="Severity"
                    value={form.dev_health.slevel}
                    disabled={saving}
                    options={SEVERITY_LEVELS}
                    onChange={(value) => patch(['dev_health', 'slevel'], value)}
                  />
                  <TextField
                    label="CPU usage (%)"
                    value={form.dev_health.cpu}
                    disabled={saving}
                    placeholder="1–100"
                    onChange={(value) => patch(['dev_health', 'cpu'], value)}
                  />
                  <TextField
                    label="Memory usage (%)"
                    value={form.dev_health.mem}
                    disabled={saving}
                    placeholder="1–100"
                    onChange={(value) => patch(['dev_health', 'mem'], value)}
                  />
                </div>
                <div className="ac-fields ac-fields--4">
                  <TextField
                    label="WAN1 (Kbps)"
                    value={form.dev_health.wan1}
                    disabled={saving}
                    onChange={(value) => patch(['dev_health', 'wan1'], value)}
                  />
                  <TextField
                    label="WAN2 (Kbps)"
                    value={form.dev_health.wan2}
                    disabled={saving}
                    onChange={(value) => patch(['dev_health', 'wan2'], value)}
                  />
                  <TextField
                    label="WAN3 (Kbps)"
                    value={form.dev_health.wan3}
                    disabled={saving}
                    onChange={(value) => patch(['dev_health', 'wan3'], value)}
                  />
                  <TextField
                    label="WAN4 (Kbps)"
                    value={form.dev_health.wan4}
                    disabled={saving}
                    onChange={(value) => patch(['dev_health', 'wan4'], value)}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === 'linkStatus' ? (
              <section className="ac-card">
                <header className="ac-card__head">
                  <div>
                    <h4 className="ac-card__title">Link Status</h4>
                    <p className="ac-card__sub">Raise an alarm when any interface is DOWN</p>
                  </div>
                  <Switch
                    checked={toBool(form.link_status.status)}
                    disabled={saving}
                    title="Enable link status alarms"
                    onChange={(checked) => patch(['link_status', 'status'], checked ? 1 : 0)}
                  />
                </header>
                <div className="ac-fields ac-fields--2">
                  <SelectField
                    label="Alarm object type"
                    value={form.link_status.olevel}
                    disabled={saving}
                    options={OBJECT_LEVELS}
                    onChange={(value) => patch(['link_status', 'olevel'], value)}
                  />
                  <SelectField
                    label="Severity"
                    value={form.link_status.slevel}
                    disabled={saving}
                    options={SEVERITY_LEVELS}
                    onChange={(value) => patch(['link_status', 'slevel'], value)}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === 'lteHealth' ? (
              <section className="ac-card">
                <header className="ac-card__head">
                  <div>
                    <h4 className="ac-card__title">LTE Health</h4>
                    <p className="ac-card__sub">Signal, packet loss, and latency per radio</p>
                  </div>
                  <Switch
                    checked={toBool(form.lte_health.status)}
                    disabled={saving}
                    title="Enable LTE health alarms"
                    onChange={(checked) => patch(['lte_health', 'status'], checked ? 1 : 0)}
                  />
                </header>
                <div className="ac-fields ac-fields--2">
                  <SelectField
                    label="Alarm object type"
                    value={form.lte_health.olevel}
                    disabled={saving}
                    options={OBJECT_LEVELS}
                    onChange={(value) => patch(['lte_health', 'olevel'], value)}
                  />
                  <SelectField
                    label="Severity"
                    value={form.lte_health.slevel}
                    disabled={saving}
                    options={SEVERITY_LEVELS}
                    onChange={(value) => patch(['lte_health', 'slevel'], value)}
                  />
                </div>
                <div className="ac-lte-grid">
                  {LTE_LIST.map((lte) => (
                    <div className="ac-lte-row" key={lte}>
                      <div className="ac-lte-row__label">
                        <span>{lte}</span>
                        <Switch
                          checked={toBool(form.lte_health[lte]?.status)}
                          disabled={saving}
                          title={`Enable ${lte}`}
                          onChange={(checked) => patch(['lte_health', lte, 'status'], checked ? 1 : 0)}
                        />
                      </div>
                      <TextField
                        label="Signal (dBm) <"
                        value={form.lte_health[lte]?.dbm}
                        disabled={saving}
                        placeholder="e.g. -95"
                        onChange={(value) => patch(['lte_health', lte, 'dbm'], value)}
                      />
                      <TextField
                        label="Packet loss (%) >"
                        value={form.lte_health[lte]?.lostp}
                        disabled={saving}
                        placeholder="e.g. 10"
                        onChange={(value) => patch(['lte_health', lte, 'lostp'], value)}
                      />
                      <TextField
                        label="Latency (ms) >"
                        value={form.lte_health[lte]?.latency}
                        disabled={saving}
                        placeholder="e.g. 250"
                        onChange={(value) => patch(['lte_health', lte, 'latency'], value)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === 'notify' ? (
              <section className="ac-card">
                <header className="ac-card__head">
                  <div>
                    <h4 className="ac-card__title">Notifications</h4>
                    <p className="ac-card__sub">Optional email and webhook when this policy fires</p>
                  </div>
                </header>
                <div className="ac-fields ac-fields--2">
                  <div className="ac-notify-field">
                    <div className="ac-notify-field__head">
                      <span className="dl-field__label">Email</span>
                      <Switch
                        checked={toBool(form.enemail)}
                        disabled={saving}
                        title="Send email"
                        onChange={(checked) => patch(['enemail'], checked ? 1 : 0)}
                      />
                    </div>
                    <input
                      value={form.email}
                      disabled={saving || !toBool(form.enemail)}
                      placeholder="ops@example.com"
                      onChange={(e) => patch(['email'], e.target.value)}
                    />
                  </div>
                  <div className="ac-notify-field">
                    <div className="ac-notify-field__head">
                      <span className="dl-field__label">Webhook URL</span>
                      <Switch
                        checked={toBool(form.enApiURL)}
                        disabled={saving}
                        title="POST to webhook"
                        onChange={(checked) => patch(['enApiURL'], checked ? 1 : 0)}
                      />
                    </div>
                    <input
                      value={form.apiURL}
                      disabled={saving || !toBool(form.enApiURL)}
                      placeholder="https://…"
                      onChange={(e) => patch(['apiURL'], e.target.value)}
                    />
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {error ? <p className="dl-error om-form__full">{error}</p> : null}

          <div className="om-form__actions om-form__full">
            <button type="button" className="dl-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dl-btn dl-btn--accent" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
