import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../api/auth';
import { fetchDashboardStats, refreshDashboardStats } from '../../api/dashboard';
import { getStoredSessionUser } from '../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../utils/theme';
import Topbar from '../common/components/Topbar';
import Sidebar from '../common/components/Sidebar';
import Footer from '../common/components/Footer';
import Widgets from './components/Widgets';
import DeviceStatusChart from './components/DeviceStatus';
import DeviceMap from './components/DeviceMap';
import TimeWiseDeviceStatus from './components/TimeWiseDeviceStatus';
import LanLteStatus from './components/LanLteStatus';
import AlarmSeverity from './components/AlarmSeverity';
import OrgWiseDeviceStatus from './components/OrgWiseDeviceStatus';
import BranchWiseDeviceStatus from './components/BranchWiseDeviceStatus';
import ZoneWiseDeviceStatus from './components/ZoneWiseDeviceStatus';
import RegionWiseDeviceStatus from './components/RegionWiseDeviceStatus';
import AlarmTable from './components/AlarmTable';
import '../../styles/dashboard.css';
import '../../styles/dash-panels.css';

export default function Dashboard({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setProfile(getStoredSessionUser());
  }, [navigate]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDashboardStats();
      setStats(data?.stats ?? data ?? null);
      // Wall-clock of this fetch — not actTime (that is now − activity window)
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load dashboard stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadStats();
    return undefined;
  }, [loadStats]);

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  const handleThemeChange = (next) => {
    setStoredTheme(next);
    setTheme(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const data = await refreshDashboardStats();
      setStats(data?.stats ?? data ?? null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
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
        onToggle={toggleSidebar}
        theme={theme}
        onThemeChange={handleThemeChange}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />

      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />

      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content" aria-label="Main content">
          {error ? <p className="dash-widgets-error">{error}</p> : null}
          {loading && !stats ? <p className="dash-widgets-loading">Loading widgets…</p> : null}
          <Widgets stats={stats} loading={loading} />
          <div className="dash-panels">
            <DeviceStatusChart stats={stats} />
            <DeviceMap />
          </div>
          <div className="dash-panels dash-panels--three">
            <TimeWiseDeviceStatus />
            <AlarmSeverity />
            <LanLteStatus stats={stats} />
          </div>
          <div className="dash-panels dash-panels--four">
            <OrgWiseDeviceStatus stats={stats} />
            <BranchWiseDeviceStatus stats={stats} />
            <ZoneWiseDeviceStatus stats={stats} />
            <RegionWiseDeviceStatus stats={stats} />
          </div>
          <AlarmTable />
        </main>
        <Footer />
      </div>
    </div>
  );
}
