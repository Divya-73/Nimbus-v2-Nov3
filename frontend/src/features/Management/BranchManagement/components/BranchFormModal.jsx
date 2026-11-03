import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const EMPTY = {
  branch: '',
  branch_type: '',
  site_id: '',
  zone: '',
  region: '',
  address: '',
  phone: '',
  email: '',
  web: '',
  tags: '',
  lat: '',
  long: '',
  outlet_code: '',
  ro_code: '',
  sales_area: '',
  outlet_name: '',
  automation_vendor: '',
  phase: '',
};

export default function BranchFormModal({ mode, initial, saving, error, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        branch: initial.branch || '',
        branch_type: initial.branch_type || '',
        site_id: initial.site_id || '',
        zone: initial.zone || '',
        region: initial.region || '',
        address: initial.address || '',
        phone: initial.phone || '',
        email: initial.email || '',
        web: initial.web || '',
        tags: initial.tags || '',
        lat: initial.lat != null ? String(initial.lat) : '',
        long: initial.long != null ? String(initial.long) : '',
        outlet_code: initial.outlet_code || '',
        ro_code: initial.ro_code || '',
        sales_area: initial.sales_area || '',
        outlet_name: initial.outlet_name || '',
        automation_vendor: initial.automation_vendor || '',
        phase: initial.phase || '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [mode, initial]);

  const title = mode === 'edit' ? 'Edit branch' : 'Create branch';

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {};
    Object.entries(form).forEach(([key, value]) => {
      payload[key] = typeof value === 'string' ? value.trim() : value;
    });
    onSubmit(payload);
  }

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="bm-form-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="bm-form-title" className="dl-gui-modal__title">
              {title}
            </h3>
            <p className="dl-gui-modal__sub">
              {mode === 'edit'
                ? 'Update branch details stored in the branch index.'
                : 'Add a new branch under this organization.'}
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field">
            <span className="dl-field__label">Branch name *</span>
            <input
              value={form.branch}
              onChange={(e) => update('branch', e.target.value)}
              required
              maxLength={200}
              disabled={saving}
              autoFocus
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Branch type</span>
            <input
              value={form.branch_type}
              onChange={(e) => update('branch_type', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Site ID</span>
            <input
              value={form.site_id}
              onChange={(e) => update('site_id', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Zone</span>
            <input
              value={form.zone}
              onChange={(e) => update('zone', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Region</span>
            <input
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
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
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Latitude</span>
            <input
              value={form.lat}
              onChange={(e) => update('lat', e.target.value)}
              maxLength={40}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Longitude</span>
            <input
              value={form.long}
              onChange={(e) => update('long', e.target.value)}
              maxLength={40}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Outlet name</span>
            <input
              value={form.outlet_name}
              onChange={(e) => update('outlet_name', e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Outlet code</span>
            <input
              value={form.outlet_code}
              onChange={(e) => update('outlet_code', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">RO code</span>
            <input
              value={form.ro_code}
              onChange={(e) => update('ro_code', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Sales area</span>
            <input
              value={form.sales_area}
              onChange={(e) => update('sales_area', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Automation vendor</span>
            <input
              value={form.automation_vendor}
              onChange={(e) => update('automation_vendor', e.target.value)}
              maxLength={120}
              disabled={saving}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">Phase</span>
            <input
              value={form.phase}
              onChange={(e) => update('phase', e.target.value)}
              maxLength={80}
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
