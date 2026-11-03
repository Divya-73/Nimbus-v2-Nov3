import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchLoginLogs } from '../../../api/loginLogs';
import { fetchManagedOrgs } from '../../../api/orgs';
import {
  getStoredSessionUser,
  hasRole,
  ROLES,
} from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import LoginLogFilters from './components/LoginLogFilters';
import LoginLogTable from './components/LoginLogTable';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 25;

/** Convert YYYY-MM-DD to unix seconds (start of day local). */
function dateToEpochStart(dateStr) {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

/** Convert YYYY-MM-DD to unix seconds (end of day local). */
function dateToEpochEnd(dateStr) {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

export default function LoginLogs({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');
  const [ip, setIp] = useState('');
  const [debouncedIp, setDebouncedIp] = useState('');
  const [status, setStatus] = useState('');
  const [orgId, setOrgId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const searchDebounceRef = useRef(null);
  const usernameDebounceRef = useRef(null);
  const ipDebounceRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const orgMap = useMemo(() => {
    const map = {};
    (organizations || []).forEach((o) => {
      map[o.id] = o.org_name || o.org || o.id;
    });
    return map;
  }, [organizations]);

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
    if (ipDebounceRef.current) clearTimeout(ipDebounceRef.current);
    ipDebounceRef.current = setTimeout(() => {
      setDebouncedIp(ip.trim());
      setPage(1);
    }, 350);
    return () => {
      if (ipDebounceRef.current) clearTimeout(ipDebounceRef.current);
    };
  }, [ip]);

  const loadOrganizations = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await fetchManagedOrgs({ page: 1, pageSize: 500 });
      setOrganizations(data.organizations || []);
    } catch {
      setOrganizations([]);
    }
  }, [isSuperAdmin]);

  const loadLogs = useCallback(
    async ({ soft = false } = {}) => {
      // After first paint, keep filter inputs interactive (hard loading steals focus)
      const useSoft = soft || hasLoadedOnceRef.current;
      if (useSoft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchLoginLogs({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          username: debouncedUsername || undefined,
          ip: debouncedIp || undefined,
          status: status || undefined,
          orgId: isSuperAdmin ? orgId || undefined : undefined,
          fromTime: dateToEpochStart(fromDate),
          toTime: dateToEpochEnd(toDate),
        });
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load login logs');
        setLogs([]);
        setTotal(0);
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      debouncedIp,
      debouncedSearch,
      debouncedUsername,
      fromDate,
      isSuperAdmin,
      orgId,
      page,
      pageSize,
      status,
      toDate,
    ]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

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
    if (key === 'ip') setIp(value);
    if (key === 'status') {
      setStatus(value);
      setPage(1);
    }
    if (key === 'orgId') {
      setOrgId(value);
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
    setUsername('');
    setDebouncedUsername('');
    setIp('');
    setDebouncedIp('');
    setStatus('');
    setOrgId('');
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
        <main className="dash-content dl-page" aria-label="Login logs">
          <LoginLogFilters
            search={search}
            username={username}
            ip={ip}
            status={status}
            orgId={orgId}
            fromDate={fromDate}
            toDate={toDate}
            organizations={organizations}
            isSuperAdmin={isSuperAdmin}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={async () => {
              await Promise.all([loadOrganizations(), loadLogs({ soft: true })]);
            }}
            onClear={handleClear}
          />

          <LoginLogTable
            logs={logs}
            orgMap={orgMap}
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
