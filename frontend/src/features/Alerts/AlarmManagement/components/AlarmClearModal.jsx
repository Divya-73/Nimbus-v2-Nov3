import React from 'react';
import { X } from 'lucide-react';

export default function AlarmClearModal({
  alarm,
  clearing,
  error,
  onClose,
  onConfirm,
}) {
  const hostname = alarm?.hostname || alarm?.devId || 'this device';
  const type = alarm?.alarmType || alarm?.type || 'alarm';

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="alarm-clear-title">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} disabled={clearing} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--sm">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="alarm-clear-title" className="dl-gui-modal__title">
              Clear alarm
            </h3>
            <p className="dl-gui-modal__sub">
              Mark <strong>{type}</strong> on <strong>{hostname}</strong> as Cleared. The log stays; end time and
              your user id are recorded.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close" disabled={clearing}>
            <X size={16} />
          </button>
        </header>

        {alarm?.detail ? <p className="dl-gui-modal__hint">{alarm.detail}</p> : null}
        {error ? <p className="dl-error">{error}</p> : null}

        <div className="om-form__actions">
          <button type="button" className="dl-btn" onClick={onClose} disabled={clearing}>
            Cancel
          </button>
          <button type="button" className="dl-btn dl-btn--accent" disabled={clearing} onClick={onConfirm}>
            {clearing ? 'Clearing…' : 'Clear alarm'}
          </button>
        </div>
      </div>
    </div>
  );
}
