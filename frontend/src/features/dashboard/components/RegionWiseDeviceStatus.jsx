import React from 'react';
import GroupWiseDeviceStatus from './GroupWiseDeviceStatus';

export default function RegionWiseDeviceStatus({ stats }) {
  return (
    <GroupWiseDeviceStatus
      title="Region-wise Status"
      rows={stats?.regionWiseDevices}
      labelKey="region"
      filterParam="region"
    />
  );
}
