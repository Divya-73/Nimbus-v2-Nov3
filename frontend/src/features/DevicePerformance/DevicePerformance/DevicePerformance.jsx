import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchDeviceById, openDeviceGui } from '../../../api/devices';
import { deleteAssignedDevice } from '../../../api/performance';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import DevicePerformanceHero from './components/DevicePerformanceHero';
import DevicePerformanceTabs, { PERF_TABS } from './components/DevicePerformanceTabs';
import DevicePerformanceCli from './components/DevicePerformanceCli';
import DevicePerformanceSkeleton from './components/DevicePerformanceSkeleton';
import DeviceDeleteModal from '../LivePerformance/components/DeviceDeleteModal';
import GuiIpPicker, { listDeviceIpv4 } from '../../Inventory/components/GuiIpPicker';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/live-performance.css';
import '../../../styles/org-management.css';

const TAB_IDS = new Set(PERF_TABS.map((tab) => tab.id));

export default function DevicePerformance({ sidebarOpen: initialSidebar = true }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const backTo = location.state?.from || '/live-performance';
  const backLabel = location.state?.fromLabel || 'Live Performance';

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryTab = String(searchParams.get('tab') || '').trim();
  const stateTab = String(location.state?.tab || '').trim();
  const wantsCli = queryTab === 'cli' || queryTab === 'ssh' || stateTab === 'cli' || stateTab === 'ssh';
  const requestedTab =
    queryTab && queryTab !== 'cli' && queryTab !== 'ssh'
      ? queryTab
      : stateTab && stateTab !== 'cli' && stateTab !== 'ssh'
        ? stateTab
        : 'general';
  const normalizedTab = requestedTab === 'onboard-config'
    ? 'iface-map'
    : requestedTab === 'provision'
      ? 'template'
      : requestedTab === 'alarm-config'
        ? 'alarm-policy'
        : requestedTab;
  const activeTab = TAB_IDS.has(normalizedTab) ? normalizedTab : 'general';
  const [cliOpen, setCliOpen] = useState(wantsCli);
  const [leaveCliTab, setLeaveCliTab] = useState(null);
  const [openingGui, setOpeningGui] = useState(false);
  const [guiPickerOpen, setGuiPickerOpen] = useState(false);
  const [guiPickerError, setGuiPickerError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const canManage =
    hasRole(profile, ROLES.SUPER_ADMIN) ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);
  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const lockedOrgId = !isSuperAdmin ? String(profile?.orgId || '').trim() : '';
  const lockedBranchId = hasRole(profile, ROLES.BRANCH_ADMIN)
    ? String(profile?.branchId || '').trim()
    : '';

  function applyTab(tabId) {
    const next = new URLSearchParams(searchParams);
    if (!tabId || tabId === 'general') next.delete('tab');
    else next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  }

  function handleTabChange(tabId) {
    if (cliOpen) {
      const tab = PERF_TABS.find((item) => item.id === tabId);
      setLeaveCliTab({ id: tabId, label: tab?.label || 'this tab' });
      return;
    }
    applyTab(tabId);
  }

  function closeCli() {
    setCliOpen(false);
    setLeaveCliTab(null);
  }

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const t = String(searchParams.get('tab') || '').trim();
    if (t !== 'cli' && t !== 'ssh') return;
    setCliOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setProfile(getStoredSessionUser());
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDeviceById(id);
      setDevice(data);
      setLastUpdated(new Date());
    } catch (err) {
      setDevice(null);
      setError(err.message || 'Failed to load device performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated() || !id) return undefined;
    load();
    return undefined;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openGuiWithIp = async (ip) => {
    if (!device?.id || openingGui) return;
    setOpeningGui(true);
    setError('');
    setGuiPickerError('');
    try {
      await openDeviceGui(device.id, { ip });
      setGuiPickerOpen(false);
    } catch (err) {
      const msg = err.message || 'Failed to open device GUI';
      if (guiPickerOpen) setGuiPickerError(msg);
      else setError(msg);
    } finally {
      setOpeningGui(false);
    }
  };

  const handleOpenGui = () => {
    if (!device?.id || openingGui) return;
    const ips = listDeviceIpv4(device);
    if (!ips.length) {
      setError('Device has no IPv4 address for GUI');
      return;
    }
    if (ips.length === 1) {
      openGuiWithIp(ips[0]);
      return;
    }
    setGuiPickerError('');
    setGuiPickerOpen(true);
  };

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`dash-root theme-${theme}${sidebarOpen ? '' : ' sidebar-closed'}`}>
      <Topbar
        onToggle={() => setSidebarOpen((o) => !o)}
        theme={theme}
        onThemeChange={(next) => {
          setStoredTheme(next);
          setTheme(next);
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />

      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />

      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Device performance detail">
          {error ? <p className="dl-error">{error}</p> : null}
          {loading && !device ? <DevicePerformanceSkeleton /> : null}

          {device ? (
            <>
              <DevicePerformanceHero
                device={device}
                loading={loading}
                refreshing={refreshing}
                openingGui={openingGui}
                cliOpen={cliOpen}
                backLabel={backLabel}
                canManage={canManage}
                onBack={() => navigate(backTo)}
                onRefresh={handleRefresh}
                onOpenGui={handleOpenGui}
                onOpenCli={() => {
                  setLeaveCliTab(null);
                  setCliOpen((open) => !open);
                }}
                onDelete={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
              />
              <DevicePerformanceTabs
                device={device}
                deviceId={device.id || id}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                refreshKey={lastUpdated}
                canManage={canManage}
                isSuperAdmin={isSuperAdmin}
                lockedOrgId={lockedOrgId}
                lockedBranchId={lockedBranchId}
                profile={profile}
                cliOpen={cliOpen}
                leaveCliTab={leaveCliTab}
                onKeepCli={() => setLeaveCliTab(null)}
                onLeaveCli={() => {
                  const nextTab = leaveCliTab?.id;
                  closeCli();
                  if (nextTab) applyTab(nextTab);
                }}
                cliPanel={
                  <DevicePerformanceCli
                    device={device}
                    canManage={canManage}
                    theme={theme}
                    onClose={closeCli}
                  />
                }
              />
              {deleteOpen ? (
                <DeviceDeleteModal
                  device={device}
                  deleting={deleting}
                  error={deleteError}
                  onClose={() => {
                    if (deleting) return;
                    setDeleteOpen(false);
                    setDeleteError('');
                  }}
                  onConfirm={async () => {
                    if (!device?.id) return;
                    setDeleting(true);
                    setDeleteError('');
                    try {
                      await deleteAssignedDevice(device.id);
                      navigate(backTo, { replace: true });
                    } catch (err) {
                      setDeleteError(err.message || 'Failed to delete device');
                      setDeleting(false);
                    }
                  }}
                />
              ) : null}
              <GuiIpPicker
                open={guiPickerOpen}
                hostname={device.hostname}
                ips={listDeviceIpv4(device)}
                busy={openingGui}
                error={guiPickerError}
                onClose={() => {
                  if (openingGui) return;
                  setGuiPickerOpen(false);
                  setGuiPickerError('');
                }}
                onSelect={openGuiWithIp}
              />
            </>
          ) : null}

          {!loading && !device && !error ? (
            <div className="dl-empty">Device not found</div>
          ) : null}
        </main>
        <Footer />
      </div>
    </div>
  );
}
