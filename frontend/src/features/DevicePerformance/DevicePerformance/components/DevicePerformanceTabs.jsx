import React, { useEffect, useMemo, useRef } from 'react';
import { Activity, Bell, Cable, FileStack, FileText, Info, ListChecks, MapPin, Network, PieChart, Radio, ScrollText, SlidersHorizontal } from 'lucide-react';
import DevicePerformanceGeneral from './DevicePerformanceGeneral';
import DevicePerformanceHealth from './DevicePerformanceHealth';
import DevicePerformanceLinkHealth from './DevicePerformanceLinkHealth';
import DevicePerformanceInterfaces from './DevicePerformanceInterfaces';
import DevicePerformanceInterfaceMap from './DevicePerformanceInterfaceMap';
import DevicePerformanceOnboardConfig from './DevicePerformanceOnboardConfig';
import DevicePerformanceTemplate from './DevicePerformanceTemplate';
import DevicePerformanceTraffic from './DevicePerformanceTraffic';
import DevicePerformanceUsage from './DevicePerformanceUsage';
import DevicePerformanceAlarms from './DevicePerformanceAlarms';
import DevicePerformanceAlarmPolicies from './DevicePerformanceAlarmPolicies';
import DevicePerformanceLogs from './DevicePerformanceLogs';
import DevicePerformanceJobs from './DevicePerformanceJobs';
import DevicePerformanceReport from './DevicePerformanceReport';

export const PERF_TABS = [
  { id: 'general', label: 'General Details', Icon: Info },
  { id: 'health', label: 'Device Health', Icon: Activity },
  { id: 'links', label: 'Link Health', Icon: Radio },
  { id: 'interfaces', label: 'Interface Health', Icon: Cable },
  { id: 'iface-map', label: 'Site Config', Icon: MapPin },
  { id: 'template', label: 'Template', Icon: FileStack },
  { id: 'traffic', label: 'Traffic', Icon: Network },
  { id: 'usage', label: 'Data Usage', Icon: PieChart },
  { id: 'alarm-policy', label: 'Alarm Policy', Icon: SlidersHorizontal },
  { id: 'alarms', label: 'Alarms', Icon: Bell },
  { id: 'logs', label: 'Logs', Icon: ScrollText },
  { id: 'jobs', label: 'Task History', Icon: ListChecks },
  { id: 'report', label: 'Report', Icon: FileText },
];

export default function DevicePerformanceTabs({
  device,
  deviceId,
  activeTab,
  onTabChange,
  refreshKey,
  canManage = false,
  isSuperAdmin = false,
  lockedOrgId = '',
  lockedBranchId = '',
  profile = null,
  cliOpen = false,
  cliPanel = null,
  leaveCliTab = null,
  onKeepCli,
  onLeaveCli,
}) {
  const tabs = useMemo(() => PERF_TABS, []);
  const tablistRef = useRef(null);

  useEffect(() => {
    const active = tablistRef.current?.querySelector('.dd-tab.is-active');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTab, cliOpen]);

  return (
    <section className="dash-panel dd-tabs-panel">
      <div ref={tablistRef} className="dd-tabs" role="tablist" aria-label="Device performance tabs">
        {tabs.map(({ id: tabId, label, Icon }) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={!cliOpen && activeTab === tabId}
            className={`dd-tab${!cliOpen && activeTab === tabId ? ' is-active' : ''}`}
            onClick={() => onTabChange(tabId)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {cliOpen && leaveCliTab ? (
        <div className="lp-cli-leave" role="dialog" aria-label="Close CLI to open tab">
          <p>
            CLI is open. Close it to view <strong>{leaveCliTab.label}</strong>?
            The SSH session will disconnect if connected.
          </p>
          <div className="lp-cli-leave__actions">
            <button type="button" className="dl-btn" onClick={onKeepCli}>
              Keep CLI
            </button>
            <button type="button" className="dl-btn dl-btn--accent" onClick={onLeaveCli}>
              Close CLI & open tab
            </button>
          </div>
        </div>
      ) : null}

      <div className="dd-tab-panel" role="tabpanel">
        {cliOpen ? cliPanel : null}
        {!cliOpen && activeTab === 'general' ? <DevicePerformanceGeneral device={device} /> : null}
        {!cliOpen && activeTab === 'health' ? (
          <DevicePerformanceHealth deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'links' ? (
          <DevicePerformanceLinkHealth deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'interfaces' ? (
          <DevicePerformanceInterfaces deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'iface-map' ? (
          <div className="lp-imap-page">
            <DevicePerformanceInterfaceMap
              deviceId={deviceId}
              refreshKey={refreshKey}
              canManage={canManage}
              isSuperAdmin={isSuperAdmin}
              lockedOrgId={lockedOrgId}
              lockedBranchId={lockedBranchId}
              profile={profile}
            />
            <DevicePerformanceOnboardConfig
              deviceId={deviceId}
              refreshKey={refreshKey}
              canManage={canManage}
            />
          </div>
        ) : null}
        {!cliOpen && activeTab === 'template' ? (
          <DevicePerformanceTemplate
            deviceId={deviceId}
            refreshKey={refreshKey}
            canManage={canManage}
          />
        ) : null}
        {!cliOpen && activeTab === 'traffic' ? (
          <DevicePerformanceTraffic deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'usage' ? (
          <DevicePerformanceUsage deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'alarm-policy' ? (
          <DevicePerformanceAlarmPolicies
            device={device}
            deviceId={deviceId}
            refreshKey={refreshKey}
            canManage={canManage}
          />
        ) : null}
        {!cliOpen && activeTab === 'alarms' ? (
          <DevicePerformanceAlarms deviceId={deviceId} refreshKey={refreshKey} canManage={canManage} />
        ) : null}
        {!cliOpen && activeTab === 'logs' ? (
          <DevicePerformanceLogs deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'jobs' ? (
          <DevicePerformanceJobs deviceId={deviceId} refreshKey={refreshKey} />
        ) : null}
        {!cliOpen && activeTab === 'report' ? (
          <DevicePerformanceReport
            device={device}
            deviceId={deviceId}
            refreshKey={refreshKey}
          />
        ) : null}
      </div>
    </section>
  );
}
