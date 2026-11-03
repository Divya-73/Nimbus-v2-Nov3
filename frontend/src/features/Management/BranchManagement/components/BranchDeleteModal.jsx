import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function BranchDeleteModal({
  branch,
  counts,
  loadingCounts,
  deleting,
  error,
  onClose,
  onConfirm,
}) {
  const name = branch?.branch || 'this branch';
  const blocked = Boolean(counts && counts.totalLinked > 0);

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="bm-del-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="bm-del-title" className="dl-gui-modal__title">
              Delete branch
            </h3>
            <p className="dl-gui-modal__sub">
              Permanently remove <strong>{name}</strong> from the branch index. This cannot be undone.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={deleting}>
            <X size={16} />
          </button>
        </header>

        {loadingCounts ? (
          <p className="dl-gui-modal__hint">Checking linked devices…</p>
        ) : counts ? (
          <div className="om-counts">
            <div className="om-counts__row">
              <span className="om-counts__label">Devices linked</span>
              <span className="om-counts__value">{counts.devices}</span>
            </div>
          </div>
        ) : null}

        {blocked ? (
          <p className="om-warn">
            <AlertTriangle size={14} aria-hidden />
            Cannot delete while devices are still linked to this branch.
          </p>
        ) : (
          <p className="dl-gui-modal__hint">No linked devices — delete is allowed.</p>
        )}

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="om-form__actions">
          <button type="button" className="dl-btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="dl-btn om-btn--danger"
            disabled={deleting || loadingCounts || blocked}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
