import React from 'react';
import { X } from 'lucide-react';
import TemplateProvisionForm from '../../shared/TemplateProvisionForm';

export default function TemplateProvisionModal({
  open,
  deviceIds = [],
  canManage = true,
  onClose,
  onDone,
}) {
  if (!open) return null;

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="lp-prov-title">
      <button
        type="button"
        className="dl-gui-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide lp-prov-card">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="lp-prov-title" className="dl-gui-modal__title">Provision template</h3>
            <p className="dl-gui-modal__sub">
              Push a saved template over MQTT to the selected CPE.
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <TemplateProvisionForm
          deviceIds={deviceIds}
          canManage={canManage}
          showDeviceList
          onCancel={onClose}
          onDone={onDone}
        />
      </div>
    </div>
  );
}
