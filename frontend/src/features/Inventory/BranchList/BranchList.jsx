import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchBranchFilterOptions, fetchBranchList } from '../../../api/branches';
import { getStoredSessionUser } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import BranchListFilters from './components/BranchListFilters';
import BranchListTable from './components/BranchListTable';
import { downloadBranchesExcel, downloadBranchesPdf } from './utils/branchExport';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';

const DEFAULT_PAGE_SIZE = 10;

function readFiltersFromParams(params) {
  return {
    search: params.get('search') || '',
    orgId: params.get('orgId') || '',
    zone: params.get('zone') || '',
    region: params.get('region') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: [10, 25, 50, 100].includes(Number(params.get('pageSize')))
      ? Number(params.get('pageSize'))
      : DEFAULT_PAGE_SIZE,
  };
}

function filtersToSearchParams(filters) {
  const next = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (key === 'page' && Number(value) === 1) return;
    if (key === 'pageSize' && Number(value) === DEFAULT_PAGE_SIZE) return;
    next.set(key, String(value));
  });
  return next;
}

export default function BranchList({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const initial = useMemo(() => readFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState(initial.search);
  const [orgId, setOrgId] = useState(initial.orgId);
  const [zone, setZone] = useState(initial.zone);
  const [region, setRegion] = useState(initial.region);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  const [allBranches, setAllBranches] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    organizations: [],
    zones: [],
    regions: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);

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
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setTimeout(() => setPage(1), 0);
        }
        return next;
      });
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      orgId,
      zone,
      region,
      page,
      pageSize,
    }),
    [debouncedSearch, orgId, zone, region, page, pageSize]
  );

  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const loadFilters = useCallback(async () => {
    try {
      const data = await fetchBranchFilterOptions();
      setFilterOptions({
        organizations: data?.organizations || [],
        zones: data?.zones || [],
        regions: data?.regions || [],
      });
    } catch {
      /* keep empty options */
    }
  }, []);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBranchList({
        search: filters.search || undefined,
        orgId: filters.orgId || undefined,
        zone: filters.zone || undefined,
        region: filters.region || undefined,
      });
      setAllBranches(data?.data || []);
      setLastUpdated(new Date());
      setPage((p) => {
        const total = (data?.data || []).length;
        const maxPage = Math.max(1, Math.ceil(total / filters.pageSize) || 1);
        return p > maxPage ? 1 : p;
      });
    } catch (err) {
      setAllBranches([]);
      setError(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.orgId, filters.zone, filters.region, filters.pageSize]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadFilters();
    return undefined;
  }, [loadFilters]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadBranches();
    return undefined;
  }, [loadBranches]);

  const total = allBranches.length;
  const pageBranches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allBranches.slice(start, start + pageSize);
  }, [allBranches, page, pageSize]);

  const handleFilterChange = (key, value) => {
    const setters = {
      search: setSearch,
      orgId: setOrgId,
      zone: setZone,
      region: setRegion,
    };
    setters[key]?.(value);
    if (key !== 'search') setPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setDebouncedSearch('');
    setOrgId('');
    setZone('');
    setRegion('');
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFilters(), loadBranches()]);
    } finally {
      setRefreshing(false);
    }
  };

  const runExport = (kind) => {
    if (exporting || total === 0) return;
    setExporting(true);
    setError('');
    try {
      if (kind === 'excel') downloadBranchesExcel(allBranches);
      else downloadBranchesPdf(allBranches);
    } catch (err) {
      setError(err.message || 'Failed to export branches');
    } finally {
      setExporting(false);
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
        <main className="dash-content dl-page" aria-label="Branch list">
          <BranchListFilters
            search={search}
            orgId={orgId}
            zone={zone}
            region={region}
            filterOptions={filterOptions}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={handleRefresh}
            onClear={handleClear}
          />

          <BranchListTable
            branches={pageBranches}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            exporting={exporting}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onView={(branchId) => navigate(`/branches/${encodeURIComponent(branchId)}`)}
            onExportExcel={() => runExport('excel')}
            onExportPdf={() => runExport('pdf')}
          />
        </main>
        <Footer />
      </div>
    </div>
  );
}
