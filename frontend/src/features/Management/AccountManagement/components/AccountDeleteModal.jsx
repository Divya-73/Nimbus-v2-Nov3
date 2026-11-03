import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AccountDeleteModal({ account, deleting, error, onClose, onConfirm }) {
  const name =
    [account?.firstname, account?.lastname].filter(Boolean).join(' ').trim() ||
    account?.email ||
    'this account';

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="am-del-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="am-del-title" className="dl-gui-modal__title">
              Delete account
            </h3>
            <p className="dl-gui-modal__sub">
              Permanently remove <strong>{name}</strong>
              {account?.email ? (
                <>
                  {' '}
                  (<strong>{account.email}</strong>)
                </>
              ) : null}
              . This cannot be undone.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={deleting}>
            <X size={16} />
          </button>
        </header>

        <p className="om-warn">
          <AlertTriangle size={14} aria-hidden />
          Please confirm you want to delete this account.
        </p>

        {error ? <p className="dl-error">{error}</p> : null}

        <div className="om-form__actions">
          <button type="button" className="dl-btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="dl-btn om-btn--danger"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
