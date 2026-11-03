import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchUserSpecificLogs } from '../../../api/userSpecificLogs';
import {
  getStoredSessionUser,
  hasRole,
  ROLES,
} from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import UserSpecificLogFilters from './components/UserSpecificLogFilters';
import UserSpecificLogTable from './components/UserSpecificLogTable';
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

function useDebouncedValue(value, delayMs, onCommit) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => {
      onCommit(String(value || '').trim());
    }, delayMs);
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, [value, delayMs, onCommit]);
}

export default function UserSpecificLogs({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [task, setTask] = useState('');
  const [debouncedTask, setDebouncedTask] = useState('');
  const [devId, setDevId] = useState('');
  const [debouncedDevId, setDebouncedDevId] = useState('');
  const [type, setType] = useState('');
  const [debouncedType, setDebouncedType] = useState('');
  const [uid, setUid] = useState('');
  const [debouncedUid, setDebouncedUid] = useState('');
  const [status, setStatus] = useState('');
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

  const commitSearch = useCallback((v) => {
    setDebouncedSearch(v);
    setPage(1);
  }, []);
  const commitTask = useCallback((v) => {
    setDebouncedTask(v);
    setPage(1);
  }, []);
  const commitDevId = useCallback((v) => {
    setDebouncedDevId(v);
    setPage(1);
  }, []);
  const commitType = useCallback((v) => {
    setDebouncedType(v);
    setPage(1);
  }, []);
  const commitUid = useCallback((v) => {
    setDebouncedUid(v);
    setPage(1);
  }, []);

  useDebouncedValue(search, 350, commitSearch);
  useDebouncedValue(task, 350, commitTask);
  useDebouncedValue(devId, 350, commitDevId);
  useDebouncedValue(type, 350, commitType);
  useDebouncedValue(uid, 350, commitUid);

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

  const loadLogs = useCallback(
    async ({ soft = false } = {}) => {
      const useSoft = soft || hasLoadedOnceRef.current;
      if (useSoft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchUserSpecificLogs({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          task: debouncedTask || undefined,
          devId: debouncedDevId || undefined,
          type: debouncedType || undefined,
          uid: isSuperAdmin ? debouncedUid || undefined : undefined,
          status: status || undefined,
          fromTime: dateToEpochStart(fromDate),
          toTime: dateToEpochEnd(toDate),
        });
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load user logs');
        setLogs([]);
        setTotal(0);
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      debouncedDevId,
      debouncedSearch,
      debouncedTask,
      debouncedType,
      debouncedUid,
      fromDate,
      isSuperAdmin,
      page,
      pageSize,
      status,
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
    if (key === 'task') setTask(value);
    if (key === 'devId') setDevId(value);
    if (key === 'type') setType(value);
    if (key === 'uid') setUid(value);
    if (key === 'status') {
      setStatus(value);
      setPage(1);
    }
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
    setTask('');
    setDebouncedTask('');
    setDevId('');
    setDebouncedDevId('');
    setType('');
    setDebouncedType('');
    setUid('');
    setDebouncedUid('');
    setStatus('');
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
        <main className="dash-content dl-page" aria-label="User specific logs">
          <UserSpecificLogFilters
            search={search}
            task={task}
            devId={devId}
            type={type}
            status={status}
            uid={uid}
            fromDate={fromDate}
            toDate={toDate}
            isSuperAdmin={isSuperAdmin}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={() => loadLogs({ soft: true })}
            onClear={handleClear}
          />

          <UserSpecificLogTable
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
