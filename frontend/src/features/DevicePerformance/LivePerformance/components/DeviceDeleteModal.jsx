import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeviceDeleteModal({ device, deleting, error, onClose, onConfirm }) {
  const name = device?.hostname || 'this device';

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="lp-del-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={deleting} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="lp-del-title" className="dl-gui-modal__title">
              Delete device
            </h3>
            <p className="dl-gui-modal__sub">
              Remove <strong>{name}</strong> from inventory. Telemetry for this CPE is also cleared.
              A row is written to Device Deletion Log.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={deleting}>
            <X size={16} />
          </button>
        </header>

        <p className="om-warn">
          <AlertTriangle size={14} aria-hidden />
          This cannot be undone.
        </p>

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="om-form__actions">
          <button type="button" className="dl-btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="dl-btn dl-btn--danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
