import React from 'react';
import GroupWiseDeviceStatus from './GroupWiseDeviceStatus';

export default function BranchWiseDeviceStatus({ stats }) {
  return (
    <GroupWiseDeviceStatus
      title="Branch-wise Status"
      rows={stats?.branchWiseDevices}
      labelKey="branch"
      filterParam="branch"
      idKey="branchId"
    />
  );
}
