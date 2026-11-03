import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus, Trash2, Unplug } from 'lucide-react';
import {
  createAlarmPolicy,
  deleteAlarmPolicy,
  fetchAlarmPolicies,
  updateAlarmPolicy,
} from '../../../../api/alarmConfiguration';
import AlarmConfigFormModal from '../../../Alerts/AlarmConfiguration/components/AlarmConfigFormModal';
import AlarmConfigDeleteModal from '../../../Alerts/AlarmConfiguration/components/AlarmConfigDeleteModal';
import {
  EMPTY_POLICY,
  enabledRuleCount,
  formatPolicyTime,
  policyFromApi,
  toBool,
} from '../../../Alerts/AlarmConfiguration/policyForm';
import '../../../../styles/org-management.css';
import '../../../../styles/alarm-configuration.css';

function includeIds(policy) {
  return (Array.isArray(policy?.include) ? policy.include : []).map(String).filter(Boolean);
}

function isThisDeviceOnly(policy, deviceId) {
  const ids = includeIds(policy);
  return ids.length === 1 && ids[0] === String(deviceId);
}

export default function DevicePerformanceAlarmPolicies({
  device,
  deviceId,
  refreshKey,
  canManage = false,
}) {
  const id = String(deviceId || device?.id || '').trim();
  const hostname = device?.hostname || device?.sysname || id;

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formInitial, setFormInitial] = useState(EMPTY_POLICY);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detachTarget, setDetachTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadPolicies = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAlarmPolicies({ page: 1, pageSize: 200, deviceId: id });
      setPolicies(data.policies || []);
    } catch (err) {
      setPolicies([]);
      setError(err.message || 'Failed to load alarm policies');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies, refreshKey]);

  function openCreate() {
    setFormMode('create');
    setFormInitial({ ...EMPTY_POLICY, include: id ? [id] : [] });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(policy) {
    if (!isThisDeviceOnly(policy, id)) return;
    setFormMode('edit');
    setFormInitial(policyFromApi({ ...policy, include: [id] }));
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    if (!canManage || !id) return;
    setFormSaving(true);
    setFormError('');
    try {
      if (!payload.policy_name) throw new Error('Policy name is required');
      payload.include = [id];
      if (formMode === 'edit') {
        if (!isThisDeviceOnly(formInitial, id)) {
          throw new Error('Shared policies can only be edited in Alarm Configuration');
        }
        await updateAlarmPolicy(formInitial.id, payload);
      } else {
        await createAlarmPolicy(payload);
      }
      setFormOpen(false);
      await loadPolicies();
    } catch (err) {
      setFormError(err.message || 'Failed to save alarm policy');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    if (!isThisDeviceOnly(deleteTarget, id)) {
      setDeleteError('Shared policies can only be deleted in Alarm Configuration');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAlarmPolicy(deleteTarget.id);
      setDeleteTarget(null);
      await loadPolicies();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete alarm policy');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDetachConfirm() {
    if (!detachTarget?.id || !id) return;
    const include = includeIds(detachTarget).filter((item) => item !== id);
    setDeleting(true);
    setDeleteError('');
    try {
      if (!include.length) {
        await deleteAlarmPolicy(detachTarget.id);
      } else {
        await updateAlarmPolicy(detachTarget.id, policyFromApi({ ...detachTarget, include }));
      }
      setDetachTarget(null);
      await loadPolicies();
    } catch (err) {
      setDeleteError(err.message || 'Failed to remove this device from the policy');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="lp-imap">
      <section className="dash-panel dl-table-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Alarm Policy</h3>
            <p className="dash-panel__meta">
              Create and edit rules for <strong>{hostname}</strong> only. Shared policies that also
              cover other CPEs are managed in{' '}
              <Link className="om-link" to="/alarm-configuration">Alarm Configuration</Link>.
            </p>
          </div>
          {canManage ? (
            <div className="dl-export-actions">
              <button type="button" className="dl-btn dl-btn--accent" onClick={openCreate} disabled={loading}>
                <Plus size={14} />
                New policy
              </button>
            </div>
          ) : null}
        </header>

        {error ? <p className="dl-error">{error}</p> : null}

        {loading && !policies.length ? (
          <div className="dl-empty">Loading alarm policies…</div>
        ) : (
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Status</th>
                  <th>Scope</th>
                  <th>Rules</th>
                  <th>Created</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {!policies.length ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5}>
                      <div className="dl-empty">No alarm policies for this device</div>
                    </td>
                  </tr>
                ) : (
                  policies.map((policy) => {
                    const enabled = toBool(policy.enpolicy ?? 1);
                    const owned = isThisDeviceOnly(policy, id);
                    const others = Math.max(includeIds(policy).length - 1, 0);
                    return (
                      <tr key={policy.id}>
                        <td className="dl-table__strong">{policy.policy_name || '—'}</td>
                        <td>
                          <span className={`dl-pill ${enabled ? 'dl-pill--up' : 'dl-pill--down'}`}>
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          {owned ? (
                            <span className="dl-pill dl-pill--up">This device</span>
                          ) : (
                            <span className="dl-pill" title="Edit or delete this policy from Alarm Configuration">
                              Shared{others ? ` · ${others + 1} devices` : ''}
                            </span>
                          )}
                        </td>
                        <td>{enabledRuleCount(policy)} / 4</td>
                        <td>{formatPolicyTime(policy.datecreated)}</td>
                        {canManage ? (
                          <td>
                            <div className="dl-row-actions">
                              {owned ? (
                                <>
                                  <button
                                    type="button"
                                    className="dl-icon-btn"
                                    title="Edit policy for this device"
                                    aria-label={`Edit ${policy.policy_name || 'policy'}`}
                                    onClick={() => openEdit(policy)}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="dl-icon-btn om-icon-btn--danger"
                                    title="Delete policy for this device"
                                    aria-label={`Delete ${policy.policy_name || 'policy'}`}
                                    onClick={() => setDeleteTarget(policy)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Link
                                    className="dl-icon-btn"
                                    to="/alarm-configuration"
                                    title="Open Alarm Configuration to edit shared policy"
                                    aria-label="Open Alarm Configuration"
                                  >
                                    <ExternalLink size={14} />
                                  </Link>
                                  <button
                                    type="button"
                                    className="dl-icon-btn"
                                    title="Remove this device only — other CPEs stay on the policy"
                                    aria-label={`Remove ${hostname} from ${policy.policy_name || 'policy'}`}
                                    onClick={() => setDetachTarget(policy)}
                                  >
                                    <Unplug size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <AlarmConfigFormModal
          mode={formMode}
          initial={formInitial}
          hideDevicePicker
          lockedDeviceIds={id ? [id] : []}
          lockedDeviceLabel={hostname}
          saving={formSaving}
          error={formError}
          onClose={() => {
            if (!formSaving) {
              setFormOpen(false);
              setFormError('');
            }
          }}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {deleteTarget ? (
        <AlarmConfigDeleteModal
          policy={deleteTarget}
          deleting={deleting}
          error={deleteError}
          description={(
            <>
              Permanently remove <strong>{deleteTarget.policy_name || 'this policy'}</strong> from{' '}
              <strong>{hostname}</strong>. Other devices are not on this policy.
            </>
          )}
          onClose={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError('');
            }
          }}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {detachTarget ? (
        <AlarmConfigDeleteModal
          policy={detachTarget}
          deleting={deleting}
          error={deleteError}
          title="Remove from this device"
          description={(
            <>
              <strong>{detachTarget.policy_name || 'This policy'}</strong> will no longer apply to{' '}
              <strong>{hostname}</strong>. Other devices stay on the policy. Edit those devices from{' '}
              Alarm Configuration.
            </>
          )}
          confirmLabel="Remove"
          onClose={() => {
            if (!deleting) {
              setDetachTarget(null);
              setDeleteError('');
            }
          }}
          onConfirm={handleDetachConfirm}
        />
      ) : null}
    </div>
  );
}
