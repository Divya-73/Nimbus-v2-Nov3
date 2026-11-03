import React, { useState } from 'react';

export default function MasterTemplateModal({
  selectedTemplates = [],
  orgId,
  model,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const [tempName, setTempName] = useState('');
  const [desc, setDesc] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      temp_name: tempName.trim(),
      desc: desc.trim(),
      orgId,
      model,
      templateIds: selectedTemplates.map((t) => t.id),
    });
  }

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-label="Create master template">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={saving} />
      <div className="dl-gui-modal__card om-modal__card">
        <header className="dl-gui-modal__head">
          <div>
            <h3 className="dl-gui-modal__title">Create master template</h3>
            <p className="dl-gui-modal__sub">
              Combine {selectedTemplates.length} template{selectedTemplates.length === 1 ? '' : 's'} · {model || 'model'}
            </p>
          </div>
        </header>

        <form className="om-form" onSubmit={handleSubmit}>
          <label className="dl-field om-form__full">
            <span className="dl-field__label">Master name</span>
            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Master template name"
              required
              disabled={saving}
            />
          </label>

          <label className="dl-field om-form__full">
            <span className="dl-field__label">Description</span>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              disabled={saving}
            />
          </label>

          <div className="om-form__full">
            <p className="tpl-master-list-label">Selected templates</p>
            <ul className="tpl-master-list">
              {selectedTemplates.map((t) => (
                <li key={t.id}>
                  <strong>{t.temp_name}</strong>
                  <span>{t.temp_type}</span>
                </li>
              ))}
            </ul>
          </div>

          {error ? <p className="dl-error om-form__full">{error}</p> : null}

          <div className="om-form__actions om-form__full">
            <button type="button" className="dl-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dl-btn dl-btn--accent" disabled={saving || !tempName.trim()}>
              {saving ? 'Creating…' : 'Create master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
