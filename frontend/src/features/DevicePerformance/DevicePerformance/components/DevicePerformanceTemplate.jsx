import React from 'react';
import TemplateProvisionForm from '../../shared/TemplateProvisionForm';

export default function DevicePerformanceTemplate({
  deviceId,
  refreshKey,
  canManage = false,
}) {
  return (
    <div className="lp-imap">
      <section className="dash-panel dl-table-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Template</h3>
            <p className="dash-panel__meta">
              Push a saved template to this CPE. Templates match its organization and model.
              MQTT only runs while the device is Up. Progress appears in Task History.
            </p>
          </div>
        </header>
        <TemplateProvisionForm
          deviceIds={deviceId ? [deviceId] : []}
          refreshKey={refreshKey}
          canManage={canManage}
          showDeviceList={false}
        />
      </section>
    </div>
  );
}
