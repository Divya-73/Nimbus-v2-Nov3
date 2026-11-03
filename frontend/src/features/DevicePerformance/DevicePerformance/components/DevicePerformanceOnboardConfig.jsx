import React, { useEffect, useState } from 'react';
import {
  fetchDeviceOnboardConfig,
  saveDeviceOnboardConfig,
} from '../../../../api/performance';
import { EMPTY_SLA, cloneInterfaceNameMap, slaFromDevice, slaPayload } from '../../../Provisioning/OnBoard/onboardAssignConfig';
import OnboardConfigFields from '../../../Provisioning/OnBoard/components/OnboardConfigFields';

function draftFromData(data) {
  return {
    tags: data?.tags || '',
    slots: { ...(data?.slots || {}) },
    nameMap: cloneInterfaceNameMap(data?.interface_name),
    latency: slaFromDevice(data, 'latency'),
    jitter: slaFromDevice(data, 'jitter'),
  };
}

export default function DevicePerformanceOnboardConfig({
  deviceId,
  refreshKey,
  canManage = false,
}) {
  const [data, setData] = useState(null);
  const [tags, setTags] = useState('');
  const [slots, setSlots] = useState({});
  const [nameMap, setNameMap] = useState({});
  const [addName, setAddName] = useState('');
  const [addOp, setAddOp] = useState('');
  const [addConId, setAddConId] = useState('');
  const [latency, setLatency] = useState(EMPTY_SLA);
  const [jitter, setJitter] = useState(EMPTY_SLA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function applyData(next) {
    const draft = draftFromData(next);
    setData(next);
    setTags(draft.tags);
    setSlots(draft.slots);
    setNameMap(draft.nameMap);
    setAddName('');
    setAddOp('');
    setAddConId('');
    setLatency(draft.latency);
    setJitter(draft.jitter);
  }

  async function load() {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    try {
      applyData(await fetchDeviceOnboardConfig(deviceId));
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load onboard config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return undefined;
  }, [deviceId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = draftFromData(data);
  const dirty =
    JSON.stringify({ tags, slots, nameMap, latency, jitter }) !==
    JSON.stringify({
      tags: saved.tags,
      slots: saved.slots,
      nameMap: saved.nameMap,
      latency: saved.latency,
      jitter: saved.jitter,
    });

  function setSla(kind, key, value) {
    const next = { ...(kind === 'latency' ? latency : jitter), [key]: value };
    if (kind === 'latency') setLatency(next);
    else setJitter(next);
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

  async function handleSave() {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      const next = await saveDeviceOnboardConfig(deviceId, {
        tags,
        interfaces: slots,
        interface_name: nameMap,
        latency: slaPayload(latency),
        jitter: slaPayload(jitter),
      });
      applyData(next);
    } catch (err) {
      setError(err.message || 'Failed to save onboard config');
    } finally {
      setSaving(false);
    }
  }

  const ifaceSlots = data?.ifaceSlots || Object.keys(slots);
  const ifaces = data?.interfaces || [];
  const assignable = data?.assignableInterfaces || ifaces;

  return (
    <div className="lp-imap">
      <section className={`dash-panel dl-table-panel${loading ? ' is-loading' : ''}`}>
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Interfaces &amp; SLA</h3>
            <p className="dash-panel__meta">
              Edit tags, physical LAN/WAN/SIM slots, operator / service ID, and latency/jitter bands.
            </p>
          </div>
        </header>

        {error ? <p className="dl-error">{error}</p> : null}

        {loading ? (
          <div className="dl-empty">Loading onboard config…</div>
        ) : (
          <>
            <div className="om-form">
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
                operators={data?.operators}
                latency={latency}
                jitter={jitter}
                onSlaChange={setSla}
                saving={saving}
                readOnly={!canManage}
              />
            </div>

            {canManage ? (
              <div className="lp-imap__actions">
                <button
                  type="button"
                  className="dl-btn"
                  disabled={saving || !dirty}
                  onClick={() => applyData(data)}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="dl-btn dl-btn--accent"
                  disabled={saving || !dirty}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
