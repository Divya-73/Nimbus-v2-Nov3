import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { EMPTY_SLA, cloneInterfaceNameMap, slaFromDevice, slaPayload } from '../onboardAssignConfig';
import OnboardConfigFields from './OnboardConfigFields';

export default function OnBoardAssignModal({
  device,
  organizations = [],
  branches = [],
  lockedOrgId,
  lockedBranchId,
  loadingLookups,
  saving,
  error,
  onClose,
  onSubmit,
  onOrgChange,
}) {
  const [orgId, setOrgId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [tags, setTags] = useState('');
  const [slots, setSlots] = useState({});
  const [nameMap, setNameMap] = useState({});
  const [addName, setAddName] = useState('');
  const [addOp, setAddOp] = useState('');
  const [addConId, setAddConId] = useState('');
  const [latency, setLatency] = useState(EMPTY_SLA);
  const [jitter, setJitter] = useState(EMPTY_SLA);

  useEffect(() => {
    if (!device) return;
    setOrgId(lockedOrgId || '');
    setBranchId(lockedBranchId || '');
    setTags(device.tags || '');
    setSlots(device.slots || {});
    setNameMap(cloneInterfaceNameMap(device.interface_name));
    setAddName('');
    setAddOp('');
    setAddConId('');
    setLatency(slaFromDevice(device, 'latency'));
    setJitter(slaFromDevice(device, 'jitter'));
  }, [device, lockedOrgId, lockedBranchId]);

  const ifaceSlots = device?.ifaceSlots || Object.keys(slots);
  const ifaces = device?.interfaces || [];
  const assignable = device?.assignableInterfaces || ifaces;

  function setSla(kind, key, value) {
    const next = { ...(kind === 'latency' ? latency : jitter), [key]: value };
    if (kind === 'latency') setLatency(next);
    else setJitter(next);
  }

  function handleOrg(value) {
    setOrgId(value);
    setBranchId('');
    onOrgChange?.(value);
  }

  function addIfaceName() {
    const name = String(addName || '').trim();
    const op = String(addOp || '').trim();
    if (!name || !op || Object.prototype.hasOwnProperty.call(nameMap, name)) return;
    setNameMap((prev) => ({ ...prev, [name]: { op, con_id: String(addConId || '').trim() } }));
    setAddName('');
    setAddOp('');
    setAddConId('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      deviceIds: [device.id],
      orgId,
      branchId,
      tags,
      interfaces: slots,
      interface_name: nameMap,
      latency: slaPayload(latency),
      jitter: slaPayload(jitter),
    });
  }

  if (!device) return null;

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="ob-assign-title">
      <button
        type="button"
        className="dl-gui-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
        disabled={saving}
      />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="ob-assign-title" className="dl-gui-modal__title">
              Assign {device.hostname}
            </h3>
            <p className="dl-gui-modal__sub">
              Map org and branch, optional interface slots, interface names, and Good/Fair/Poor latency and jitter bands (ms).
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Organization *</span>
            <select
              value={orgId}
              onChange={(e) => handleOrg(e.target.value)}
              required
              disabled={saving || Boolean(lockedOrgId) || loadingLookups}
            >
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.org_name || org.org || org.id}
                </option>
              ))}
            </select>
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Branch *</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              disabled={saving || Boolean(lockedBranchId) || loadingLookups || !orgId}
            >
              <option value="">Select branch</option>
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.branch || br.branch_name || br.id}
                </option>
              ))}
            </select>
          </label>

          <OnboardConfigFields
            tags={tags}
            onTagsChange={setTags}
            slots={slots}
            onSlotChange={(slot, value) => setSlots((prev) => ({ ...prev, [slot]: value }))}
            ifaceSlots={ifaceSlots}
            ifaces={ifaces}
            nameMap={nameMap}
            onNameEntryChange={(name, entry) => setNameMap((prev) => ({ ...prev, [name]: entry }))}
            onRemoveName={(name) =>
              setNameMap((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
              })
            }
            onAddName={addIfaceName}
            addName={addName}
            onAddNameChange={setAddName}
            addOp={addOp}
            onAddOpChange={setAddOp}
            addConId={addConId}
            onAddConIdChange={setAddConId}
            assignable={assignable}
            operators={device?.operators}
            latency={latency}
            jitter={jitter}
            onSlaChange={setSla}
            saving={saving}
          />

          {error ? <p className="dl-error om-form__full">{error}</p> : null}

          <div className="om-form__actions om-form__full">
            <button type="button" className="dl-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dl-btn dl-btn--accent" disabled={saving || loadingLookups}>
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
