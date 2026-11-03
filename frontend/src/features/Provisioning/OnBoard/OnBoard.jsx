import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { assignOnboardDevice, deleteOnboardDevice, fetchOnboardDevice, fetchOnboardDevices } from '../../../api/onboard';
import { fetchManagedOrgs } from '../../../api/orgs';
import { fetchManagedBranches } from '../../../api/branches';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import OnBoardFilters from './components/OnBoardFilters';
import OnBoardTable from './components/OnBoardTable';
import OnBoardAssignModal from './components/OnBoardAssignModal';
import OnBoardDeleteModal from './components/OnBoardDeleteModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/template-creation.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 10;

function readFiltersFromParams(params) {
  return {
    search: params.get('search') || '',
    model: params.get('model') || '',
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

export default function OnBoard({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const initial = useMemo(() => readFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState(initial.search);
  const [model, setModel] = useState(initial.model);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  const [devices, setDevices] = useState([]);
  const [models, setModels] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const isOrgAdmin = hasRole(profile, ROLES.ORG_ADMIN);
  const isBranchAdmin = hasRole(profile, ROLES.BRANCH_ADMIN);
  const canManage = isSuperAdmin || isOrgAdmin || isBranchAdmin;
  const lockedOrgId = !isSuperAdmin ? String(profile?.orgId || '').trim() : '';
  const lockedBranchId = isBranchAdmin ? String(profile?.branchId || '').trim() : '';

  const [assignDevice, setAssignDevice] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      model,
      page,
      pageSize,
    }),
    [debouncedSearch, model, page, pageSize]
  );

  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const loadList = useCallback(async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchOnboardDevices({
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        model: filters.model || undefined,
      });
      setDevices(data?.devices || []);
      setTotal(Number(data?.total) || 0);
      setModels(Array.isArray(data?.models) ? data.models : []);
      setLastUpdated(new Date());
    } catch (err) {
      setDevices([]);
      setTotal(0);
      setError(err.message || 'Failed to load onboard devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadList();
    return undefined;
  }, [loadList]);

  const loadOrganizations = useCallback(async () => {
    if (!canManage) return;
    try {
      if (isSuperAdmin) {
        const data = await fetchManagedOrgs({ page: 1, pageSize: 500 });
        setOrganizations(data.organizations || []);
      } else if (lockedOrgId) {
        setOrganizations([
          {
            id: lockedOrgId,
            org_name: profile?.organization || profile?.orgName || lockedOrgId,
            org: profile?.organization || '',
          },
        ]);
      }
    } catch {
      setOrganizations([]);
    }
  }, [canManage, isSuperAdmin, lockedOrgId, profile]);

  const loadBranchesForOrg = useCallback(async (targetOrgId) => {
    const id = String(targetOrgId || '').trim();
    if (!id) {
      setBranches([]);
      return;
    }
    if (lockedBranchId) {
      setBranches([{ id: lockedBranchId, branch: lockedBranchId }]);
      return;
    }
    setLookupsLoading(true);
    try {
      const data = await fetchManagedBranches({
        orgId: id,
        page: 1,
        pageSize: 500,
      });
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLookupsLoading(false);
    }
  }, [lockedBranchId]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (lockedOrgId) loadBranchesForOrg(lockedOrgId);
  }, [lockedOrgId, loadBranchesForOrg]);

  async function openAssign(row) {
    if (!row?.id) return;
    setAssignError('');
    setLookupsLoading(true);
    try {
      const detail = await fetchOnboardDevice(row.id);
      setAssignDevice({ ...row, ...detail });
      if (lockedOrgId) await loadBranchesForOrg(lockedOrgId);
      else setBranches([]);
    } catch (err) {
      setAssignDevice(null);
      setError(err.message || 'Failed to load onboard device');
    } finally {
      setLookupsLoading(false);
    }
  }

  function closeAssign() {
    if (assignSaving) return;
    setAssignDevice(null);
    setAssignError('');
  }

  async function handleAssignSubmit(payload) {
    setAssignSaving(true);
    setAssignError('');
    try {
      await assignOnboardDevice(payload);
      setAssignDevice(null);
      await loadList({ soft: true });
    } catch (err) {
      setAssignError(err.message || 'Failed to assign device');
    } finally {
      setAssignSaving(false);
    }
  }

  function openDelete(row) {
    setDeleteError('');
    setDeleteTarget(row);
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOnboardDevice(deleteTarget.id);
      setDeleteTarget(null);
      await loadList({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete onboard device');
    } finally {
      setDeleting(false);
    }
  }

  const handleFilterChange = (key, value) => {
    if (key === 'search') setSearch(value);
    if (key === 'model') {
      setModel(value);
      setPage(1);
    }
  };

  const handleClear = () => {
    setSearch('');
    setDebouncedSearch('');
    setModel('');
    setPage(1);
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
        onToggle={() => setSidebarOpen((open) => !open)}
        theme={theme}
        onThemeChange={(next) => {
          setStoredTheme(next);
          setTheme(next);
        }}
        onRefresh={() => loadList({ soft: true })}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page tpl-page" aria-label="On board devices">
          <section className="tpl-hero">
            <div>
              <p className="tpl-hero__eyebrow">Provisioning</p>
              <h2 className="tpl-hero__title">On Board</h2>
              <p className="tpl-hero__meta">
                Unassigned CPEs that have checked in. Map organization and branch to add them to the managed estate.
              </p>
            </div>
            <div className="tpl-hero__stats">
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : total}</span>
                <span className="tpl-stat__label">Unassigned</span>
              </div>
            </div>
          </section>

          <OnBoardFilters
            search={search}
            model={model}
            models={models}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={() => loadList({ soft: true })}
            onClear={handleClear}
          />

          <OnBoardTable
            devices={devices}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            canManage={canManage}
            onAssign={openAssign}
            onDelete={openDelete}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </main>
        <Footer />
      </div>
      {assignDevice ? (
        <OnBoardAssignModal
          device={assignDevice}
          organizations={organizations}
          branches={branches}
          lockedOrgId={lockedOrgId}
          lockedBranchId={lockedBranchId}
          loadingLookups={lookupsLoading}
          saving={assignSaving}
          error={assignError}
          onClose={closeAssign}
          onSubmit={handleAssignSubmit}
          onOrgChange={loadBranchesForOrg}
        />
      ) : null}
      {deleteTarget ? (
        <OnBoardDeleteModal
          device={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={closeDelete}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </div>
  );
}
