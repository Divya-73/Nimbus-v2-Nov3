import React, { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Globe,
  MapPin,
  Router,
  Store,
} from 'lucide-react';
import {
  deviceStatusPillClass,
  formatSdwan,
  orgStatusPillClass,
  sdwanPillClass,
} from '../utils/statusHelpers';

const LEVEL_META = {
  organization: { label: 'Organization', Icon: Building2 },
  branch: { label: 'Branch', Icon: Store },
  zone: { label: 'Zone', Icon: Globe },
  region: { label: 'Region', Icon: MapPin },
  device: { label: 'Device', Icon: Router },
};

function CountMeta({ deviceCount, status }) {
  const dc = deviceCount || { total: 0, up: 0, down: 0, upPercentage: 0 };
  return (
    <span className="oh-tree__meta">
      <span className="oh-tree__counts">
        {dc.total} · {dc.up} up · {dc.down} down · {dc.upPercentage}%
      </span>
      {status ? <span className={orgStatusPillClass(status)}>{status}</span> : null}
    </span>
  );
}

function TreeNode({
  id,
  type,
  name,
  deviceCount,
  status,
  defaultOpen = false,
  children,
  trailing,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = Boolean(children);
  const meta = LEVEL_META[type] || LEVEL_META.device;
  const Icon = meta.Icon;

  return (
    <li className={`oh-tree__node oh-tree__node--${type}`}>
      <div className="oh-tree__row">
        {hasChildren ? (
          <button
            type="button"
            className="oh-tree__toggle"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="oh-tree__toggle oh-tree__toggle--spacer" />
        )}
        <span className={`oh-tree__badge oh-tree__badge--${type}`} title={meta.label}>
          <Icon size={13} />
          <span>{meta.label}</span>
        </span>
        <span className="oh-tree__name">{name}</span>
        {deviceCount || status ? <CountMeta deviceCount={deviceCount} status={status} /> : null}
        {trailing}
      </div>
      {hasChildren && open ? <ul className="oh-tree__children">{children}</ul> : null}
    </li>
  );
}

function DeviceLeaf({ device, onViewDevice }) {
  return (
    <li className="oh-tree__node oh-tree__node--device">
      <div className="oh-tree__row oh-tree__row--device">
        <span className="oh-tree__toggle oh-tree__toggle--spacer" />
        <span className="oh-tree__badge oh-tree__badge--device" title="Device">
          <Router size={13} />
          <span>Device</span>
        </span>
        <span className="oh-tree__name">{device.hostname || device.sysname}</span>
        <span className="oh-tree__meta">
          <span className="oh-tree__counts">{device.model || '—'}</span>
          <span className={deviceStatusPillClass(device.status)}>{device.status || '—'}</span>
          <span className={sdwanPillClass(device.sdwanStatus)}>
            {formatSdwan(device.sdwanStatus)}
          </span>
          <span className="oh-tree__counts">{device.uptime || '—'}</span>
        </span>
        <button
          type="button"
          className="dl-icon-btn"
          title="View device"
          aria-label={`View ${device.hostname || device.sysname}`}
          onClick={() => onViewDevice?.(device)}
        >
          <Eye size={14} />
        </button>
      </div>
    </li>
  );
}

export default function OrgHierarchyTree({
  hierarchy,
  loading,
  error,
  onViewDevice,
  expandAll = false,
}) {
  const orgs = useMemo(() => hierarchy || [], [hierarchy]);

  if (loading) {
    return <div className="dl-empty">Loading hierarchy…</div>;
  }

  if (error) {
    return <p className="dl-error">{error}</p>;
  }

  if (!orgs.length) {
    return <div className="dl-empty">No hierarchy for selected filters</div>;
  }

  return (
    <div className="oh-tree-wrap">
      <ul className="oh-tree" role="tree" aria-label="Organization hierarchy">
        {orgs.map((org) => (
          <TreeNode
            key={org.orgId || org.id}
            id={org.orgId}
            type="organization"
            name={org.name}
            deviceCount={org.deviceCount}
            status={org.status}
            defaultOpen={expandAll || orgs.length <= 3}
          >
            {(org.branches || []).map((branch) => (
              <TreeNode
                key={`${org.orgId}:${branch.name}`}
                type="branch"
                name={branch.name}
                deviceCount={branch.deviceCount}
                status={branch.status}
                defaultOpen={expandAll}
              >
                {(branch.zones || []).map((zone) => (
                  <TreeNode
                    key={`${org.orgId}:${branch.name}:${zone.name}`}
                    type="zone"
                    name={zone.name}
                    deviceCount={zone.deviceCount}
                    status={zone.status}
                    defaultOpen={expandAll}
                  >
                    {(zone.regions || []).map((region) => (
                      <TreeNode
                        key={`${org.orgId}:${branch.name}:${zone.name}:${region.name}`}
                        type="region"
                        name={region.name}
                        deviceCount={region.deviceCount}
                        status={region.status}
                        defaultOpen={expandAll}
                      >
                        {(region.devices || []).map((device) => (
                          <DeviceLeaf
                            key={device.id}
                            device={device}
                            onViewDevice={onViewDevice}
                          />
                        ))}
                      </TreeNode>
                    ))}
                  </TreeNode>
                ))}
              </TreeNode>
            ))}
          </TreeNode>
        ))}
      </ul>
    </div>
  );
}

export { LEVEL_META };
