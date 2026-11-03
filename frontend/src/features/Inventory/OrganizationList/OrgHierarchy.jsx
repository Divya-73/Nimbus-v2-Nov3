import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GitBranch, Maximize2, Minimize2 } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchOrgFilterOptions, fetchOrgHierarchy } from '../../../api/orgs';
import { getStoredSessionUser } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import OrgListFilters from './components/OrgListFilters';
import OrgHierarchyTree from './components/OrgHierarchyTree';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';

function readFiltersFromParams(params) {
  return {
    search: params.get('search') || '',
    zone: params.get('zone') || '',
    region: params.get('region') || '',
    branch: params.get('branch') || '',
  };
}

function filtersToSearchParams(filters) {
  const next = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === '') return;
    next.set(key, String(value));
  });
  return next;
}

export default function OrgHierarchy({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const initial = useMemo(() => readFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState(initial.search);
  const [zone, setZone] = useState(initial.zone);
  const [region, setRegion] = useState(initial.region);
  const [branch, setBranch] = useState(initial.branch);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);
  const searchDebounceRef = useRef(null);

  const [hierarchy, setHierarchy] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    zones: [],
    regions: [],
    branches: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [treeKey, setTreeKey] = useState(0);
  const [expandAll, setExpandAll] = useState(false);

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
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      zone,
      region,
      branch,
    }),
    [debouncedSearch, zone, region, branch]
  );

  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const loadFilters = useCallback(async () => {
    try {
      const data = await fetchOrgFilterOptions();
      setFilterOptions({
        zones: data?.zones || [],
        regions: data?.regions || [],
        branches: data?.branches || [],
      });
    } catch {
      /* keep empty */
    }
  }, []);

  const loadHierarchy = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOrgHierarchy({
        search: filters.search || undefined,
        zone: filters.zone || undefined,
        region: filters.region || undefined,
        branch: filters.branch || undefined,
      });
      setHierarchy(data?.data || []);
      setLastUpdated(new Date());
      setTreeKey((k) => k + 1);
    } catch (err) {
      setHierarchy([]);
      setError(err.message || 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.zone, filters.region, filters.branch]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadFilters();
    return undefined;
  }, [loadFilters]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadHierarchy();
    return undefined;
  }, [loadHierarchy]);

  const handleFilterChange = (key, value) => {
    const setters = {
      search: setSearch,
      zone: setZone,
      region: setRegion,
      branch: setBranch,
    };
    setters[key]?.(value);
  };

  const handleClear = () => {
    setSearch('');
    setDebouncedSearch('');
    setZone('');
    setRegion('');
    setBranch('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFilters(), loadHierarchy()]);
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

  const backToList = () => {
    const qs = filtersToSearchParams(filters).toString();
    navigate(`/inventory/org-list${qs ? `?${qs}` : ''}`);
  };

  const deviceCount = hierarchy.reduce((n, o) => n + (o.deviceCount?.total || 0), 0);

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
        <main className="dash-content dl-page" aria-label="Organization hierarchy">
          <OrgListFilters
            search={search}
            zone={zone}
            region={region}
            branch={branch}
            filterOptions={filterOptions}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={handleRefresh}
            onClear={handleClear}
          />

          <section className="dash-panel dl-table-panel">
            <header className="dash-panel__head">
              <div>
                <button
                  type="button"
                  className="dl-btn"
                  onClick={backToList}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <ArrowLeft size={14} />
                  Back to table
                </button>
                <h3 className="dash-panel__title">
                  <GitBranch size={16} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  Hierarchy view
                </h3>
                <p className="dash-panel__meta">
                  Org → Branch → Zone → Region → Device · {hierarchy.length} organizations ·{' '}
                  {deviceCount} devices
                </p>
              </div>
              <div className="dl-export-actions">
                <button
                  type="button"
                  className="dl-btn"
                  onClick={() => {
                    setExpandAll(true);
                    setTreeKey((k) => k + 1);
                  }}
                  disabled={loading || !hierarchy.length}
                  title="Expand all levels"
                >
                  <Maximize2 size={14} />
                  Expand all
                </button>
                <button
                  type="button"
                  className="dl-btn"
                  onClick={() => {
                    setExpandAll(false);
                    setTreeKey((k) => k + 1);
                  }}
                  disabled={loading || !hierarchy.length}
                  title="Collapse all levels"
                >
                  <Minimize2 size={14} />
                  Collapse all
                </button>
              </div>
            </header>

            <OrgHierarchyTree
              key={treeKey}
              hierarchy={hierarchy}
              loading={loading}
              error={error}
              expandAll={expandAll}
              onViewDevice={(d) =>
                navigate(`/live-performance/${encodeURIComponent(d.id)}`, {
                  state: {
                    from: `/inventory/org-list/hierarchy${window.location.search || ''}`,
                    fromLabel: 'Hierarchy',
                  },
                })
              }
            />
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
