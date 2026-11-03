import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { INTERFACE_OPERATORS, ONBOARD_SLA_FIELDS, operatorOptions } from '../onboardAssignConfig';

function entryOf(nameMap, name) {
  const raw = nameMap?.[name];
  if (raw && typeof raw === 'object') {
    return { op: String(raw.op || '').trim(), con_id: String(raw.con_id || '').trim() };
  }
  return { op: String(raw || '').trim(), con_id: '' };
}

export default function OnboardConfigFields({
  tags,
  onTagsChange,
  slots,
  onSlotChange,
  ifaceSlots = [],
  ifaces = [],
  nameMap = {},
  onNameEntryChange,
  onRemoveName,
  onAddName,
  addName,
  onAddNameChange,
  addOp,
  onAddOpChange,
  addConId,
  onAddConIdChange,
  assignable = [],
  operators = INTERFACE_OPERATORS,
  latency = {},
  jitter = {},
  onSlaChange,
  saving = false,
  readOnly = false,
}) {
  const disabled = saving || readOnly;
  const assignedNames = useMemo(
    () => Object.keys(nameMap).sort((a, b) => a.localeCompare(b)),
    [nameMap]
  );
  const extraOps = assignedNames.map((name) => entryOf(nameMap, name).op);
  const opChoices = useMemo(
    () => operatorOptions([addOp, ...extraOps], operators),
    [addOp, extraOps, operators]
  );
  const slotOptions = useMemo(() => {
    const names = new Set((ifaces || []).map((name) => String(name || '').trim()).filter(Boolean));
    for (const value of Object.values(slots || {})) {
      const name = String(value || '').trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [ifaces, slots]);
  const availableNames = useMemo(
    () => assignable.filter((name) => !Object.prototype.hasOwnProperty.call(nameMap, name)),
    [assignable, nameMap]
  );

  return (
    <>
      <label className="dl-field om-form__full">
        <span className="dl-field__label">Tags</span>
        <input
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          maxLength={200}
          disabled={disabled}
          placeholder="Optional group / tags"
        />
      </label>

      <div className="om-form__full ob-assign__block">
        <p className="ob-assign__label">Physical interfaces</p>
        <p className="dash-panel__meta">
          Map LAN/WAN/SIM slots to names this CPE already reported. Leave blank to skip a slot.
        </p>
        <div className="ob-assign__slots">
          {ifaceSlots.map((slot) => (
            <label key={slot} className="dl-field">
              <span className="dl-field__label">{slot}</span>
              <select
                value={slots[slot] || ''}
                onChange={(e) => onSlotChange(slot, e.target.value)}
                disabled={disabled || !slotOptions.length}
              >
                <option value="">—</option>
                {slotOptions.map((name) => (
                  <option key={`${slot}-${name}`} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="om-form__full ob-assign__block">
        <p className="ob-assign__label">Operator / service ID</p>
        <p className="dash-panel__meta">
          Assign an operator (Airtel, Jio, VI, …) and service ID to a reported CPE interface.
        </p>
        {availableNames.length && !readOnly ? (
          <div className="ob-assign__names-add">
            <label className="dl-field">
              <span className="dl-field__label">Interface</span>
              <select
                value={addName}
                onChange={(e) => onAddNameChange(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select reported interface</option>
                {availableNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dl-field">
              <span className="dl-field__label">Operator</span>
              <select
                value={addOp}
                onChange={(e) => onAddOpChange(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select operator</option>
                {opChoices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dl-field">
              <span className="dl-field__label">Service ID</span>
              <input
                value={addConId}
                onChange={(e) => onAddConIdChange(e.target.value)}
                maxLength={80}
                disabled={disabled}
                placeholder="Connection / service ID"
              />
            </label>
            <button
              type="button"
              className="dl-btn dl-btn--accent"
              onClick={onAddName}
              disabled={disabled || !addName || !addOp}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        ) : null}
        {assignedNames.length ? (
          <div className="dl-table-scroll ob-assign__names-table">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Interface</th>
                  <th>Operator</th>
                  <th>Service ID</th>
                  {!readOnly ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {assignedNames.map((name) => {
                  const row = entryOf(nameMap, name);
                  const rowOps = operatorOptions([row.op], operators);
                  return (
                    <tr key={name}>
                      <td className="dl-table__strong">{name}</td>
                      <td>
                        <select
                          value={row.op}
                          onChange={(e) => onNameEntryChange(name, { ...row, op: e.target.value })}
                          disabled={disabled}
                        >
                          <option value="">Select operator</option>
                          {rowOps.map((opName) => (
                            <option key={opName} value={opName}>
                              {opName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={row.con_id}
                          onChange={(e) => onNameEntryChange(name, { ...row, con_id: e.target.value })}
                          maxLength={80}
                          disabled={disabled}
                          placeholder="Service ID"
                        />
                      </td>
                      {!readOnly ? (
                        <td>
                          <button
                            type="button"
                            className="dl-icon-btn om-icon-btn--danger"
                            title={`Remove ${name}`}
                            aria-label={`Remove ${name}`}
                            disabled={disabled}
                            onClick={() => onRemoveName(name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dash-panel__meta">No operator / service ID assigned yet.</p>
        )}
      </div>

      <div className="om-form__full ob-assign__block">
        <p className="ob-assign__label">Latency threshold (ms)</p>
        <div className="ob-assign__sla">
          {ONBOARD_SLA_FIELDS.map(([key, label]) => (
            <label key={`lat-${key}`} className="dl-field">
              <span className="dl-field__label">{label}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={latency[key] ?? ''}
                onChange={(e) => onSlaChange('latency', key, e.target.value)}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="om-form__full ob-assign__block">
        <p className="ob-assign__label">Jitter threshold (ms)</p>
        <div className="ob-assign__sla">
          {ONBOARD_SLA_FIELDS.map(([key, label]) => (
            <label key={`jit-${key}`} className="dl-field">
              <span className="dl-field__label">{label}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={jitter[key] ?? ''}
                onChange={(e) => onSlaChange('jitter', key, e.target.value)}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
