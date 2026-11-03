import React from 'react';
import GroupWiseDeviceStatus from './GroupWiseDeviceStatus';

export default function ZoneWiseDeviceStatus({ stats }) {
  return (
    <GroupWiseDeviceStatus
      title="Zone-wise Status"
      rows={stats?.zoneWiseDevices}
      labelKey="zone"
      filterParam="zone"
    />
  );
}
