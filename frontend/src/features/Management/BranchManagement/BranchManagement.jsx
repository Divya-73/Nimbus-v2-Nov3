import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchOrgDoc } from '../../../api/orgs';
import {
  createBranch,
  deleteBranch,
  fetchBranchCounts,
  fetchBranchFilterOptions,
  fetchManagedBranches,
  updateBranch,
} from '../../../api/branches';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import BranchManageFilters from './components/BranchManageFilters';
import BranchManageTable from './components/BranchManageTable';
import BranchFormModal from './components/BranchFormModal';
import BranchDeleteModal from './components/BranchDeleteModal';
import BranchBulkUploadModal from './components/BranchBulkUploadModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/branch-management.css';

const DEFAULT_PAGE_SIZE = 25;

function CopyIdBtn({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const onCopy = async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="dd-icon-btn"
      onClick={onCopy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function BranchManagement({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId: orgIdParam } = useParams();
  const orgId = decodeURIComponent(String(orgIdParam || '').trim());

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [orgName, setOrgName] = useState(
    () => location.state?.orgName || location.state?.org || ''
  );
  const [orgLoading, setOrgLoading] = useState(!orgName);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [zone, setZone] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [branches, setBranches] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState({ zones: [], regions: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCounts, setDeleteCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);

  const searchDebounceRef = useRef(null);
  const canManage =
    hasRole(profile, ROLES.SUPER_ADMIN) || hasRole(profile, ROLES.ORG_ADMIN);

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
    let cancelled = false;
    async function loadOrg() {
      if (!orgId) return;

      const stateName = location.state?.orgName || location.state?.org || '';
      if (stateName && location.state?.orgId === orgId) {
        setOrgName(stateName);
        setOrgLoading(false);
        return;
      }

      setOrgLoading(true);
      try {
        const doc = await fetchOrgDoc(orgId);
        if (!cancelled) {
          setOrgName(doc.org_name || doc.org || orgId);
        }
      } catch {
        if (!cancelled) {
          setOrgName((prev) => prev || orgId);
        }
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    }
    loadOrg();
    return () => {
      cancelled = true;
    };
  }, [orgId, location.state]);

  const loadFilterOptions = useCallback(async () => {
    if (!canManage || !orgId) return;
    try {
      const data = await fetchBranchFilterOptions({ orgId });
      setFilterOptions({
        zones: data.zones || [],
        regions: data.regions || [],
      });
    } catch {
      setFilterOptions({ zones: [], regions: [] });
    }
  }, [canManage, orgId]);

  const loadBranches = useCallback(
    async ({ soft = false } = {}) => {
      if (!canManage || !orgId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchManagedBranches({
          page,
          pageSize,
          orgId,
          search: debouncedSearch || undefined,
          zone: zone.trim() || undefined,
          region: region.trim() || undefined,
        });
        setBranches(data.branches || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load branches');
        setBranches([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManage, debouncedSearch, orgId, page, pageSize, region, zone]
  );

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFilterChange(key, value) {
    if (key === 'search') setSearch(value);
    if (key === 'zone') {
      setZone(value);
      setPage(1);
    }
    if (key === 'region') {
      setRegion(value);
      setPage(1);
    }
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setZone('');
    setRegion('');
    setPage(1);
  }

  function openCreate() {
    setFormMode('create');
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(branch) {
    setFormMode('edit');
    setEditing(branch);
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    setFormSaving(true);
    setFormError('');
    try {
      if (formMode === 'edit' && editing?.id) {
        await updateBranch(editing.id, payload);
      } else {
        await createBranch({ ...payload, orgId });
      }
      setFormOpen(false);
      setEditing(null);
      await Promise.all([loadFilterOptions(), loadBranches({ soft: true })]);
    } catch (err) {
      setFormError(err.message || 'Failed to save branch');
    } finally {
      setFormSaving(false);
    }
  }

  async function openDelete(branch) {
    setDeleteTarget(branch);
    setDeleteCounts(null);
    setDeleteError('');
    setLoadingCounts(true);
    try {
      const counts = await fetchBranchCounts(branch.id);
      setDeleteCounts(counts);
    } catch (err) {
      setDeleteError(err.message || 'Failed to load linked counts');
    } finally {
      setLoadingCounts(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteBranch(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteCounts(null);
      await Promise.all([loadFilterOptions(), loadBranches({ soft: true })]);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!orgId) {
    return <Navigate to="/inventory/org-crud" replace />;
  }

  const displayName = orgName || orgId;

  const shell = (content) => (
    <div className={`dash-root theme-${theme}${sidebarOpen ? '' : ' sidebar-closed'}`}>
      <Topbar
        onToggle={() => setSidebarOpen((o) => !o)}
        theme={theme}
        onThemeChange={(next) => {
          setStoredTheme(next);
          setTheme(next);
        }}
        onRefresh={canManage ? () => loadBranches({ soft: true }) : undefined}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Branch management">
          {content}
        </main>
        <Footer />
      </div>
    </div>
  );

  if (!canManage) {
    return shell(
      <section className="dash-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Branch Management</h3>
            <p className="dash-panel__meta">Branch create, update, and delete</p>
          </div>
        </header>
        <p className="dl-error">Org admin or super admin access is required to manage branches.</p>
      </section>
    );
  }

  return shell(
    <>
      <section className="dash-panel bm-org-banner">
        <header className="dash-panel__head">
          <div className="bm-org-banner__main">
            <button
              type="button"
              className="bm-back"
              onClick={() => navigate('/inventory/org-crud')}
            >
              <ArrowLeft size={14} />
              Back to organizations
            </button>
            <h3 className="dash-panel__title">
              {orgLoading ? 'Loading organization…' : displayName}
            </h3>
            <p className="dash-panel__meta">Branch management for this organization</p>
            {orgId ? (
              <div className="bm-org-id-row">
                <span className="dd-meta-id bm-org-id" title={orgId}>
                  <span className="bm-org-id__label">Org ID</span>
                  <span className="bm-org-id__value">{orgId}</span>
                  <CopyIdBtn value={orgId} label="organization id" />
                </span>
              </div>
            ) : null}
          </div>
        </header>
      </section>

      <BranchManageFilters
        search={search}
        zone={zone}
        region={region}
        filterOptions={filterOptions}
        loading={loading || refreshing}
        onChange={handleFilterChange}
        onRefresh={async () => {
          await Promise.all([loadFilterOptions(), loadBranches({ soft: true })]);
        }}
        onClear={handleClear}
      />

      <BranchManageTable
        branches={branches}
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
        onCreate={openCreate}
        onBulkUpload={() => setBulkOpen(true)}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      {formOpen ? (
        <BranchFormModal
          mode={formMode}
          initial={editing}
          saving={formSaving}
          error={formError}
          onClose={() => {
            if (!formSaving) {
              setFormOpen(false);
              setEditing(null);
              setFormError('');
            }
          }}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {bulkOpen ? (
        <BranchBulkUploadModal
          orgId={orgId}
          onClose={() => setBulkOpen(false)}
          onDone={async () => {
            await Promise.all([loadFilterOptions(), loadBranches({ soft: true })]);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <BranchDeleteModal
          branch={deleteTarget}
          counts={deleteCounts}
          loadingCounts={loadingCounts}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteCounts(null);
              setDeleteError('');
            }
          }}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </>
  );
}
