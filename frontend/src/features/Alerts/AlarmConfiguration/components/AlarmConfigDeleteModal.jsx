import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AlarmConfigDeleteModal({
  policy,
  deleting,
  error,
  title = 'Delete alarm policy',
  description,
  confirmLabel = 'Delete',
  onClose,
  onConfirm,
}) {
  const name = policy?.policy_name || 'this alarm policy';

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="ac-del-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={deleting} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="ac-del-title" className="dl-gui-modal__title">
              {title}
            </h3>
            <p className="dl-gui-modal__sub">
              {description || (
                <>
                  Permanently remove <strong>{name}</strong>. Devices will no longer raise alarms from this policy.
                </>
              )}
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
          <button type="button" className="dl-btn om-btn--danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? `${confirmLabel.replace(/…$/, '')}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
