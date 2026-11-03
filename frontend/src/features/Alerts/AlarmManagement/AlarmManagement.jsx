import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  clearAlarmLog,
  fetchAlarmManageFilters,
  fetchAlarmManageStats,
  fetchAlarms,
  fetchAllAlarmsForExport,
} from '../../../api/alarms';
import {
  getStoredSessionUser,
  hasRole,
  ROLES,
} from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import AlarmManageFilters from './components/AlarmManageFilters';
import AlarmDashboardCharts from './components/AlarmDashboardCharts';
import AlarmManageTable from './components/AlarmManageTable';
import AlarmClearModal from './components/AlarmClearModal';
import {
  DEFAULT_VISIBLE_COLUMNS,
  loadVisibleColumns,
  saveVisibleColumns,
} from './utils/columnConfig';
import {
  exportAlarmsExcel,
  exportAlarmsPdf,
  stampFilename,
} from './utils/alarmExport';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/live-performance.css';
import '../../../styles/alarm-management.css';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SEVERITIES = ['Critical', 'Warning', 'Cleared', 'cleared'];
const DEFAULT_STATES = ['Open', 'Closed'];

function mergeOptions(defaults, fromApi) {
  const seen = new Set();
  const out = [];
  for (const raw of [...defaults, ...(fromApi || [])]) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function useDebounced(value, delayMs, onCommit) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => onCommit(String(value || '').trim()), delayMs);
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, [value, delayMs, onCommit]);
}

export default function AlarmManagement({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const canClear =
    isSuperAdmin ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [host, setHost] = useState('');
  const [debouncedHost, setDebouncedHost] = useState('');
  const [siteId, setSiteId] = useState('');
  const [debouncedSiteId, setDebouncedSiteId] = useState('');
  const [severity, setSeverity] = useState('');
  const [state, setState] = useState('');
  const [alarmType, setAlarmType] = useState('');
  const [objectLevel, setObjectLevel] = useState('');
  const [policy, setPolicy] = useState('');
  const [tags, setTags] = useState('');
  const [org, setOrg] = useState('');
  const [branch, setBranch] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [alarms, setAlarms] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    severities: DEFAULT_SEVERITIES,
    states: DEFAULT_STATES,
    types: [],
    organizations: [],
    branches: [],
    objectLevels: [],
    policies: [],
    tags: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const hasLoadedOnceRef = useRef(false);

  const commitSearch = useCallback((v) => {
    setDebouncedSearch(v);
    setPage(1);
  }, []);
  const commitHost = useCallback((v) => {
    setDebouncedHost(v);
    setPage(1);
  }, []);
  const commitSiteId = useCallback((v) => {
    setDebouncedSiteId(v);
    setPage(1);
  }, []);

  useDebounced(search, 350, commitSearch);
  useDebounced(host, 350, commitHost);
  useDebounced(siteId, 350, commitSiteId);

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

  const buildListFilters = useCallback(() => {
    return {
      severity: severity || undefined,
      state: state || undefined,
      alarmType: alarmType || undefined,
      objectLevel: objectLevel || undefined,
      policy: policy || undefined,
      tags: tags || undefined,
      host: debouncedHost || undefined,
      siteId: debouncedSiteId || undefined,
      search: debouncedSearch || undefined,
      org: isSuperAdmin ? org || undefined : undefined,
      branch: branch || undefined,
      timeRange: timeRange === 'all' ? undefined : timeRange,
    };
  }, [
    alarmType,
    branch,
    debouncedHost,
    debouncedSearch,
    debouncedSiteId,
    isSuperAdmin,
    objectLevel,
    org,
    policy,
    severity,
    state,
    tags,
    timeRange,
  ]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await fetchAlarmManageFilters();
      setFilterOptions({
        severities: mergeOptions(DEFAULT_SEVERITIES, options?.severities),
        states: mergeOptions(DEFAULT_STATES, options?.states),
        types: options?.types || [],
        organizations: options?.organizations || [],
        branches: options?.branches || [],
        objectLevels: options?.objectLevels || [],
        policies: options?.policies || [],
        tags: options?.tags || [],
      });
    } catch {
      setFilterOptions((prev) => ({
        ...prev,
        severities: mergeOptions(DEFAULT_SEVERITIES, prev.severities),
        states: mergeOptions(DEFAULT_STATES, prev.states),
      }));
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      // Same filters as table so charts stay in sync
      const data = await fetchAlarmManageStats(buildListFilters());
      setStats(data || null);
    } catch (err) {
      setStatsError(err.message || 'Failed to load alarm stats');
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [buildListFilters]);

  const loadAlarms = useCallback(
    async ({ soft = false } = {}) => {
      const useSoft = soft || hasLoadedOnceRef.current;
      if (useSoft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchAlarms({
          page,
          pageSize,
          ...buildListFilters(),
        });
        setAlarms(data.alarms || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load alarms');
        setAlarms([]);
        setTotal(0);
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildListFilters, page, pageSize]
  );

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFilterChange(key, value) {
    const map = {
      search: setSearch,
      host: setHost,
      siteId: setSiteId,
      severity: setSeverity,
      state: setState,
      alarmType: setAlarmType,
      objectLevel: setObjectLevel,
      policy: setPolicy,
      tags: setTags,
      org: setOrg,
      branch: setBranch,
      timeRange: setTimeRange,
    };
    if (map[key]) map[key](value);
    if (!['search', 'host', 'siteId'].includes(key)) setPage(1);
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setHost('');
    setDebouncedHost('');
    setSiteId('');
    setDebouncedSiteId('');
    setSeverity('');
    setState('');
    setAlarmType('');
    setObjectLevel('');
    setPolicy('');
    setTags('');
    setOrg('');
    setBranch('');
    setTimeRange('24h');
    setPage(1);
  }

  function handleVisibleColumnsChange(ids) {
    setVisibleColumns(ids);
    saveVisibleColumns(ids);
  }

  function handleResetColumns() {
    const next = [...DEFAULT_VISIBLE_COLUMNS];
    setVisibleColumns(next);
    saveVisibleColumns(next);
  }

  async function runExport(kind) {
    setExporting(true);
    setError('');
    try {
      const { alarms: rows } = await fetchAllAlarmsForExport(buildListFilters());
      if (!rows.length) {
        setError('No alarms to export for current filters');
        return;
      }
      if (kind === 'excel') {
        exportAlarmsExcel(rows, visibleColumns, stampFilename('alarms', 'xlsx'));
      } else {
        exportAlarmsPdf(rows, visibleColumns, stampFilename('alarms', 'pdf'));
      }
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleClearConfirm() {
    if (!clearTarget?.id || !canClear) return;
    setClearing(true);
    setClearError('');
    try {
      await clearAlarmLog(clearTarget.id);
      setClearTarget(null);
      await Promise.all([loadStats(), loadAlarms({ soft: true })]);
    } catch (err) {
      setClearError(err.message || 'Failed to clear alarm');
    } finally {
      setClearing(false);
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
        onRefresh={async () => {
          await Promise.all([loadStats(), loadAlarms({ soft: true })]);
        }}
        refreshing={refreshing || statsLoading}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Alarm management">
          <AlarmManageFilters
            search={search}
            host={host}
            siteId={siteId}
            severity={severity}
            state={state}
            alarmType={alarmType}
            objectLevel={objectLevel}
            policy={policy}
            tags={tags}
            org={org}
            branch={branch}
            timeRange={timeRange}
            options={filterOptions}
            isSuperAdmin={isSuperAdmin}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={async () => {
              await Promise.all([
                loadFilterOptions(),
                loadStats(),
                loadAlarms({ soft: true }),
              ]);
            }}
            onClear={handleClear}
          />

          <AlarmDashboardCharts
            stats={stats}
            loading={statsLoading}
            error={statsError}
          />

          <AlarmManageTable
            alarms={alarms}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            visibleColumns={visibleColumns}
            columnPickerOpen={columnPickerOpen}
            exporting={exporting}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onVisibleColumnsChange={handleVisibleColumnsChange}
            onColumnPickerToggle={setColumnPickerOpen}
            onResetColumns={handleResetColumns}
            onExportExcel={() => runExport('excel')}
            onExportPdf={() => runExport('pdf')}
            canClear={canClear}
            clearingId={clearing ? clearTarget?.id : ''}
            onClear={setClearTarget}
          />

          {clearTarget ? (
            <AlarmClearModal
              alarm={clearTarget}
              clearing={clearing}
              error={clearError}
              onClose={() => {
                if (!clearing) {
                  setClearTarget(null);
                  setClearError('');
                }
              }}
              onConfirm={handleClearConfirm}
            />
          ) : null}
        </main>
        <Footer />
      </div>
    </div>
  );
}
