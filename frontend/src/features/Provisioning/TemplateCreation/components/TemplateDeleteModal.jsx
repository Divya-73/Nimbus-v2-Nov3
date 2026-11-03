import React, { useState } from 'react';

export default function TemplateDeleteModal({ template, deleting, error, onClose, onConfirm }) {
  const [confirmName, setConfirmName] = useState('');
  const expected = String(template?.temp_name || '').trim();
  const canDelete = confirmName.trim() === expected;

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-label="Delete template">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={deleting} />
      <div className="dl-gui-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 className="dl-gui-modal__title">Delete template</h3>
            <p className="dl-gui-modal__sub">This removes the template metadata and file.</p>
          </div>
        </header>

        <p className="tpl-delete-copy">
          Type <strong>{expected || '—'}</strong> to confirm deletion.
        </p>

        <label className="dl-field">
          <span className="dl-field__label">Template name</span>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            disabled={deleting}
            placeholder={expected}
          />
        </label>

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="om-form__actions tpl-modal-actions">
          <button type="button" className="dl-btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="dl-btn dl-btn--danger"
            disabled={!canDelete || deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete template'}
          </button>
        </div>
      </div>
    </div>
  );
}
