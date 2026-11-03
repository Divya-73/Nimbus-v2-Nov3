import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const EMPTY = {
  id: '',
  act_name: '',
  act_type: 'config',
  orgId: '',
  model: '',
  templateFile: '',
  templateName: '',
  firmware: '',
  keep: true,
  force: false,
  selectedIds: [],
};

function CheckChip({ label, checked, disabled, onChange }) {
  return (
    <label className="gc-check">
      <input
        type="checkbox"
        className="tpl-check-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function GroupConfigFormModal({
  mode,
  initial,
  organizations = [],
  models = [],
  templates = [],
  firmwares = [],
  devices = [],
  loadingLookups,
  saving,
  error,
  onClose,
  onSubmit,
  onLookupsChange,
}) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = mode === 'edit';

  useEffect(() => {
    setForm({
      ...EMPTY,
      ...(initial || {}),
      selectedIds: Array.isArray(initial?.selectedIds) ? initial.selectedIds : [],
      keep: initial?.keep !== false,
      force: Boolean(initial?.force),
    });
  }, [initial, mode]);

  const selectedSet = useMemo(
    () => new Set((Array.isArray(form.selectedIds) ? form.selectedIds : []).map(String)),
    [form.selectedIds]
  );
  const allIds = devices.map((d) => String(d.id));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));

  function update(patch, reload = false) {
    const next = { ...form, ...patch };
    setForm(next);
    if (reload) {
      onLookupsChange?.({
        orgId: next.orgId,
        model: next.model,
        act_type: next.act_type,
        selectedIds: next.selectedIds,
      });
    }
  }

  function toggleDevice(id) {
    const key = String(id);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setForm((prev) => ({ ...prev, selectedIds: Array.from(next) }));
  }

  function toggleAll(checked) {
    setForm((prev) => ({ ...prev, selectedIds: checked ? allIds : [] }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      ...form,
      act_name: form.act_name.trim(),
      selectedIds: form.selectedIds,
    });
  }

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="gc-form-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={saving} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="gc-form-title" className="dl-gui-modal__title">
              {isEdit ? 'Edit config' : 'New config'}
            </h3>
            <p className="dl-gui-modal__sub">
              {isEdit
                ? 'Rename the activity and update the device set. Type, org, model, and artifact stay locked.'
                : 'Push a template or firmware to a set of devices in one activity.'}
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Activity name</span>
            <input
              value={form.act_name}
              onChange={(e) => update({ act_name: e.target.value })}
              placeholder="Activity name"
              disabled={saving}
              required
              autoFocus
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Activity type</span>
            {isEdit ? (
              <input value={form.act_type === 'upgrade' ? 'Firmware upgrade' : 'Config'} disabled readOnly />
            ) : (
              <select
                value={form.act_type}
                disabled={saving}
                onChange={(e) =>
                  update(
                    {
                      act_type: e.target.value,
                      templateFile: '',
                      templateName: '',
                      firmware: '',
                      selectedIds: [],
                    },
                    true
                  )
                }
              >
                <option value="config">Config</option>
                <option value="upgrade">Firmware upgrade</option>
              </select>
            )}
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Organization</span>
            {isEdit ? (
              <input value={organizations.find((o) => o.id === form.orgId)?.name || form.orgId} disabled readOnly />
            ) : (
              <select
                value={form.orgId}
                disabled={saving}
                onChange={(e) =>
                  update({ orgId: e.target.value, model: '', selectedIds: [], templateFile: '', firmware: '' }, true)
                }
              >
                <option value="">— Select organization —</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name || org.org_name || org.id}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Model</span>
            {isEdit ? (
              <input value={form.model} disabled readOnly />
            ) : (
              <select
                value={form.model}
                disabled={saving || !form.orgId}
                onChange={(e) =>
                  update({ model: e.target.value, selectedIds: [], templateFile: '', firmware: '' }, true)
                }
              >
                <option value="">— Select model —</option>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
          </label>

          {form.act_type === 'config' ? (
            <label className="dl-field om-form__full">
              <span className="dl-field__label">Template</span>
              {isEdit ? (
                <input value={form.templateName || form.t_name || form.templateFile} disabled readOnly />
              ) : (
                <select
                  value={form.templateFile}
                  disabled={saving || !form.model}
                  onChange={(e) => {
                    const file = e.target.value;
                    const found = templates.find((t) => t.file === file);
                    update({ templateFile: file, templateName: found?.name || '' });
                  }}
                >
                  <option value="">— Select template —</option>
                  {templates.map((tpl) => (
                    <option key={tpl.file} value={tpl.file}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <>
              <label className="dl-field">
                <span className="dl-field__label">Firmware</span>
                {isEdit ? (
                  <input value={form.firmware || form.f_name} disabled readOnly />
                ) : (
                  <select
                    value={form.firmware}
                    disabled={saving || !form.model}
                    onChange={(e) => update({ firmware: e.target.value })}
                  >
                    <option value="">— Select firmware —</option>
                    {firmwares.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <div className="dl-field">
                <span className="dl-field__label">Options</span>
                {isEdit ? (
                  <input
                    value={[form.keep ? 'Keep settings' : null, form.force ? 'Force upgrade' : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    disabled
                    readOnly
                  />
                ) : (
                  <div className="gc-option-row">
                    <CheckChip label="Keep settings" checked={form.keep} disabled={saving} onChange={(keep) => update({ keep })} />
                    <CheckChip label="Force upgrade" checked={form.force} disabled={saving} onChange={(force) => update({ force })} />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="om-form__full">
            <div className="gc-device-head">
              <div>
                <h3 className="dash-panel__title">Devices</h3>
                <p className="dash-panel__meta">
                  {loadingLookups
                    ? 'Loading devices…'
                    : `${selectedSet.size} selected${devices.length ? ` of ${devices.length}` : ''}`}
                </p>
              </div>
              <CheckChip
                label="Select all"
                checked={allSelected}
                disabled={!devices.length || saving}
                onChange={toggleAll}
              />
            </div>

            <div className="dl-table-scroll gc-device-scroll">
              <table className="dl-table">
                <thead>
                  <tr>
                    <th className="tpl-th-check" aria-label="Select" />
                    <th>Hostname</th>
                    <th>Model</th>
                    <th>Firmware</th>
                    <th>Status</th>
                    <th>Org</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const checked = selectedSet.has(String(device.id));
                    return (
                      <tr key={device.id} className={checked ? 'tpl-row--selected' : undefined}>
                        <td className="tpl-th-check">
                          <input
                            type="checkbox"
                            className="tpl-check-input"
                            checked={checked}
                            onChange={() => toggleDevice(device.id)}
                            disabled={saving}
                            aria-label={`Select ${device.sysname || device.id}`}
                          />
                        </td>
                        <td className="dl-table__strong">{device.sysname || '—'}</td>
                        <td>
                          <code className="tpl-code">{device.model || '—'}</code>
                        </td>
                        <td>{device.version || '—'}</td>
                        <td>
                          <span className={`dl-pill dl-pill--${device.up ? 'up' : 'down'}`}>
                            {device.up ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="om-cell-clip">{device.orgName || '—'}</td>
                      </tr>
                    );
                  })}
                  {!devices.length ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="dl-empty">
                          {form.orgId && form.model
                            ? 'No devices for this org and model'
                            : 'Select organization and model to load devices'}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {error ? <p className="dl-error om-form__full">{error}</p> : null}

          <div className="om-form__actions om-form__full">
            <button type="button" className="dl-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dl-btn dl-btn--accent" disabled={saving || loadingLookups}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
