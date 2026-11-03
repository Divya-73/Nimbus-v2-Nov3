import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const EMPTY = {
  org_name: '',
  org: '',
  address: '',
  phone: '',
  email: '',
  web: '',
  logo: '',
};

export default function OrgFormModal({ mode, initial, saving, error, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        org_name: initial.org_name || '',
        org: initial.org || '',
        address: initial.address || '',
        phone: initial.phone || '',
        email: initial.email || '',
        web: initial.web || '',
        logo: initial.logo || '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [mode, initial]);

  const title = mode === 'edit' ? 'Edit organization' : 'Create organization';

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      org_name: form.org_name.trim(),
      org: form.org.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      web: form.web.trim(),
      logo: form.logo.trim(),
    });
  }

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="om-form-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="om-form-title" className="dl-gui-modal__title">
              {title}
            </h3>
            <p className="dl-gui-modal__sub">
              {mode === 'edit'
                ? 'Update organization details stored in the org index.'
                : 'Add a new organization document to the org index.'}
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Organization name *</span>
            <input
              value={form.org_name}
              onChange={(e) => update('org_name', e.target.value)}
              required
              maxLength={200}
              placeholder="Display name"
              disabled={saving}
              autoFocus
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Org code</span>
            <input
              value={form.org}
              onChange={(e) => update('org', e.target.value)}
              maxLength={120}
              placeholder="Optional short code"
              disabled={saving}
            />
          </label>

          <label className="dl-field om-form__full">
            <span className="dl-field__label">Address</span>
            <input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              maxLength={500}
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
            <span className="dl-field__label">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Website</span>
            <input
              value={form.web}
              onChange={(e) => update('web', e.target.value)}
              maxLength={300}
              placeholder="https://"
              disabled={saving}
            />
          </label>

          <label className="dl-field">
            <span className="dl-field__label">Logo URL</span>
            <input
              value={form.logo}
              onChange={(e) => update('logo', e.target.value)}
              maxLength={500}
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
