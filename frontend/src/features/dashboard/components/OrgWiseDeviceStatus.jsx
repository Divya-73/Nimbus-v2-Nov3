import React from 'react';
import GroupWiseDeviceStatus from './GroupWiseDeviceStatus';

export default function OrgWiseDeviceStatus({ stats }) {
  return (
    <GroupWiseDeviceStatus
      title="Organization-wise Status"
      rows={stats?.orgWiseDevices}
      labelKey="organization"
      filterParam="org"
      idKey="orgId"
    />
  );
}
