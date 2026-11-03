import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchDeviceDeletionLogs } from '../../../api/deviceDeletionLogs';
import {
  getStoredSessionUser,
  hasRole,
  ROLES,
} from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import DeviceDeletionLogFilters from './components/DeviceDeletionLogFilters';
import DeviceDeletionLogTable from './components/DeviceDeletionLogTable';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 25;

function dateToEpochStart(dateStr) {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

function dateToEpochEnd(dateStr) {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

export default function DeviceDeletionLogs({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');
  const [sysname, setSysname] = useState('');
  const [debouncedSysname, setDebouncedSysname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [debouncedSessionId, setDebouncedSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [debouncedUserId, setDebouncedUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const hasLoadedOnceRef = useRef(false);
  const searchDebounceRef = useRef(null);
  const usernameDebounceRef = useRef(null);
  const sysnameDebounceRef = useRef(null);
  const sessionDebounceRef = useRef(null);
  const userIdDebounceRef = useRef(null);

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

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(() => {
      setDebouncedUsername(username.trim());
      setPage(1);
    }, 350);
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [username]);

  useEffect(() => {
    if (sysnameDebounceRef.current) clearTimeout(sysnameDebounceRef.current);
    sysnameDebounceRef.current = setTimeout(() => {
      setDebouncedSysname(sysname.trim());
      setPage(1);
    }, 350);
    return () => {
      if (sysnameDebounceRef.current) clearTimeout(sysnameDebounceRef.current);
    };
  }, [sysname]);

  useEffect(() => {
    if (sessionDebounceRef.current) clearTimeout(sessionDebounceRef.current);
    sessionDebounceRef.current = setTimeout(() => {
      setDebouncedSessionId(sessionId.trim());
      setPage(1);
    }, 350);
    return () => {
      if (sessionDebounceRef.current) clearTimeout(sessionDebounceRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (userIdDebounceRef.current) clearTimeout(userIdDebounceRef.current);
    userIdDebounceRef.current = setTimeout(() => {
      setDebouncedUserId(userId.trim());
      setPage(1);
    }, 350);
    return () => {
      if (userIdDebounceRef.current) clearTimeout(userIdDebounceRef.current);
    };
  }, [userId]);

  const loadLogs = useCallback(
    async ({ soft = false } = {}) => {
      const useSoft = soft || hasLoadedOnceRef.current;
      if (useSoft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchDeviceDeletionLogs({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          username: debouncedUsername || undefined,
          sysname: debouncedSysname || undefined,
          sessionId: debouncedSessionId || undefined,
          userId: isSuperAdmin ? debouncedUserId || undefined : undefined,
          fromTime: dateToEpochStart(fromDate),
          toTime: dateToEpochEnd(toDate),
        });
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load device deletion logs');
        setLogs([]);
        setTotal(0);
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      debouncedSearch,
      debouncedSessionId,
      debouncedSysname,
      debouncedUserId,
      debouncedUsername,
      fromDate,
      isSuperAdmin,
      page,
      pageSize,
      toDate,
    ]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFilterChange(key, value) {
    if (key === 'search') setSearch(value);
    if (key === 'username') setUsername(value);
    if (key === 'sysname') setSysname(value);
    if (key === 'sessionId') setSessionId(value);
    if (key === 'userId') setUserId(value);
    if (key === 'fromDate') {
      setFromDate(value);
      setPage(1);
    }
    if (key === 'toDate') {
      setToDate(value);
      setPage(1);
    }
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setUsername('');
    setDebouncedUsername('');
    setSysname('');
    setDebouncedSysname('');
    setSessionId('');
    setDebouncedSessionId('');
    setUserId('');
    setDebouncedUserId('');
    setFromDate('');
    setToDate('');
    setPage(1);
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
        onRefresh={() => loadLogs({ soft: true })}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Device deletion logs">
          <DeviceDeletionLogFilters
            search={search}
            username={username}
            sysname={sysname}
            sessionId={sessionId}
            userId={userId}
            fromDate={fromDate}
            toDate={toDate}
            isSuperAdmin={isSuperAdmin}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={() => loadLogs({ soft: true })}
            onClear={handleClear}
          />

          <DeviceDeletionLogTable
            logs={logs}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </main>
        <Footer />
      </div>
    </div>
  );
}
