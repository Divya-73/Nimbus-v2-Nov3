import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ROLES } from '../../../../utils/roleManagement';
import {
  PASSWORD_POLICY,
  POLICY_SUMMARY,
  passwordStrengthLabel,
  validatePassword,
} from '../../../../utils/passwordPolicy';

const EMPTY = {
  email: '',
  pass: '',
  firstname: '',
  lastname: '',
  phone: '',
  role: ROLES.VIEWER,
  orgId: '',
  branchId: '',
  tags: '',
  active: '1',
};

export default function AccountFormModal({
  mode,
  initial,
  organizations,
  branches,
  isSuperAdmin,
  lockedOrgId,
  saving,
  error,
  onClose,
  onSubmit,
  onOrgChange,
}) {
  const [form, setForm] = useState(EMPTY);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        email: initial.email || '',
        pass: '',
        firstname: initial.firstname || '',
        lastname: initial.lastname || '',
        phone: initial.phone || '',
        role: String(initial.role || ROLES.VIEWER),
        orgId: initial.orgId || lockedOrgId || '',
        branchId: initial.branchId || '',
        tags: initial.tags || '',
        active: initial.active != null ? String(initial.active) : '1',
      });
    } else {
      setForm({
        ...EMPTY,
        orgId: lockedOrgId || '',
        role: isSuperAdmin ? ROLES.VIEWER : ROLES.VIEWER,
      });
    }
  }, [mode, initial, lockedOrgId, isSuperAdmin]);

  const title = mode === 'edit' ? 'Edit account' : 'Create account';

  const roleOptions = [
    ...(isSuperAdmin ? [{ value: ROLES.SUPER_ADMIN, label: 'Super Admin' }] : []),
    { value: ROLES.ORG_ADMIN, label: 'Org Admin' },
    { value: ROLES.BRANCH_ADMIN, label: 'Branch Admin' },
    { value: ROLES.VIEWER, label: 'Viewer' },
  ];

  function update(key, value) {
    if (key === 'orgId') {
      setForm((prev) => ({ ...prev, orgId: value, branchId: '' }));
      onOrgChange?.(value);
      return;
    }
    if (key === 'pass') {
      setPasswordError('');
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      email: form.email.trim(),
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      phone: form.phone.trim(),
      role: form.role,
      orgId: (lockedOrgId || form.orgId || '').trim(),
      branchId: form.branchId.trim(),
      tags: form.tags.trim(),
      active: form.active,
    };
    if (form.pass.trim()) {
      payload.pass = form.pass.trim();
    }
    if (mode === 'create' && !payload.pass) {
      setPasswordError('Password is required');
      return;
    }
    if (payload.pass) {
      const { isValid, errors } = validatePassword(payload.pass, { email: payload.email });
      if (!isValid) {
        setPasswordError(errors[0] || 'Password does not meet policy requirements');
        return;
      }
    }
    setPasswordError('');
    onSubmit(payload);
  }

  const strength = form.pass ? passwordStrengthLabel(form.pass) : '';
  const strengthClass =
    strength === 'Strong'
      ? 'am-password-strength--strong'
      : strength === 'Good' || strength === 'Fair'
        ? 'am-password-strength--fair'
        : strength
          ? 'am-password-strength--weak'
          : '';

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="am-form-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="am-form-title" className="dl-gui-modal__title">
              {title}
            </h3>
            <p className="dl-gui-modal__sub">
              {mode === 'edit'
                ? 'Update account details. Leave password blank to keep the current password.'
                : 'Create a new user account in the access index.'}
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
              maxLength={200}
              disabled={saving}
              autoFocus
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">
              Password {mode === 'create' ? '*' : '(optional)'}
            </span>
            <input
              type="password"
              value={form.pass}
              onChange={(e) => update('pass', e.target.value)}
              required={mode === 'create'}
              minLength={mode === 'create' ? PASSWORD_POLICY.minLength : undefined}
              maxLength={PASSWORD_POLICY.maxLength}
              disabled={saving}
              placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''}
              autoComplete="new-password"
              aria-describedby="am-password-policy"
            />
            <p id="am-password-policy" className="dl-field__hint">
              {POLICY_SUMMARY}
            </p>
            {strength ? (
              <p className={`am-password-strength ${strengthClass}`} aria-live="polite">
                Strength: {strength}
              </p>
            ) : null}
            {passwordError ? <p className="dl-error">{passwordError}</p> : null}
          </label>

          <label className="dl-field">
            <span className="dl-field__label">First name</span>
            <input
              value={form.firstname}
              onChange={(e) => update('firstname', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Last name</span>
            <input
              value={form.lastname}
              onChange={(e) => update('lastname', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              maxLength={60}
              disabled={saving}
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Role *</span>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              required
              disabled={saving}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Organization</span>
            {isSuperAdmin ? (
              <select
                value={form.orgId}
                onChange={(e) => update('orgId', e.target.value)}
                disabled={saving || form.role === ROLES.SUPER_ADMIN}
              >
                <option value="">— Select organization —</option>
                {(organizations || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.org_name || o.org || o.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={
                  (organizations || []).find((o) => o.id === (lockedOrgId || form.orgId))
                    ?.org_name ||
                  lockedOrgId ||
                  form.orgId ||
                  ''
                }
                disabled
                readOnly
              />
            )}
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Branch</span>
            <select
              value={form.branchId}
              onChange={(e) => update('branchId', e.target.value)}
              disabled={saving || !form.orgId}
            >
              <option value="">— Optional —</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch || b.id}
                </option>
              ))}
            </select>
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Status</span>
            <select
              value={form.active}
              onChange={(e) => update('active', e.target.value)}
              disabled={saving}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Tags</span>
            <input
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </label>

          {error ? <p className="dl-error om-form__full">{error}</p> : null}

          <div className="om-form__actions om-form__full">
            <button type="button" className="dl-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dl-btn dl-btn--accent" disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
