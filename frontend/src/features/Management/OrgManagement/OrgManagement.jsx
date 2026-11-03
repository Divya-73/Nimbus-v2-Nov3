import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createOrg,
  deleteOrg,
  fetchManagedOrgs,
  fetchOrgCounts,
  updateOrg,
} from '../../../api/orgs';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import OrgManageFilters from './components/OrgManageFilters';
import OrgManageTable from './components/OrgManageTable';
import OrgFormModal from './components/OrgFormModal';
import OrgDeleteModal from './components/OrgDeleteModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 25;

export default function OrgManagement({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [orgs, setOrgs] = useState([]);
  const [total, setTotal] = useState(0);
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

  const searchDebounceRef = useRef(null);
  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);

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

  const loadOrgs = useCallback(
    async ({ soft = false } = {}) => {
      if (!isSuperAdmin) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchManagedOrgs({
          page,
          pageSize,
          search: debouncedSearch || undefined,
        });
        setOrgs(data.organizations || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load organizations');
        setOrgs([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, isSuperAdmin, page, pageSize]
  );

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFilterChange(key, value) {
    if (key === 'search') setSearch(value);
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }

  function openCreate() {
    setFormMode('create');
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(org) {
    setFormMode('edit');
    setEditing(org);
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    setFormSaving(true);
    setFormError('');
    try {
      if (formMode === 'edit' && editing?.id) {
        await updateOrg(editing.id, payload);
      } else {
        await createOrg(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await loadOrgs({ soft: true });
    } catch (err) {
      setFormError(err.message || 'Failed to save organization');
    } finally {
      setFormSaving(false);
    }
  }

  async function openDelete(org) {
    setDeleteTarget(org);
    setDeleteCounts(null);
    setDeleteError('');
    setLoadingCounts(true);
    try {
      const counts = await fetchOrgCounts(org.id);
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
      await deleteOrg(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteCounts(null);
      await loadOrgs({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete organization');
    } finally {
      setDeleting(false);
    }
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const shell = (content) => (
    <div className={`dash-root theme-${theme}${sidebarOpen ? '' : ' sidebar-closed'}`}>
      <Topbar
        onToggle={() => setSidebarOpen((o) => !o)}
        theme={theme}
        onThemeChange={(next) => {
          setStoredTheme(next);
          setTheme(next);
        }}
        onRefresh={isSuperAdmin ? () => loadOrgs({ soft: true }) : undefined}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Organization management">
          {content}
        </main>
        <Footer />
      </div>
    </div>
  );

  if (!isSuperAdmin) {
    return shell(
      <section className="dash-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Org Management</h3>
            <p className="dash-panel__meta">Organization create, update, and delete</p>
          </div>
        </header>
        <p className="dl-error">Super admin access is required to manage organizations.</p>
      </section>
    );
  }

  return shell(
    <>
      <OrgManageFilters
        search={search}
        loading={loading || refreshing}
        onChange={handleFilterChange}
        onRefresh={() => loadOrgs({ soft: true })}
        onClear={handleClear}
      />

      <OrgManageTable
        orgs={orgs}
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
        onOpenBranches={(org) => {
          const id = String(org?.id || '').trim();
          if (!id) return;
          navigate(`/inventory/org-crud/${encodeURIComponent(id)}/branches`, {
            state: {
              orgId: id,
              orgName: org.org_name || org.org || '',
              org: org.org || '',
            },
          });
        }}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      {formOpen ? (
        <OrgFormModal
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

      {deleteTarget ? (
        <OrgDeleteModal
          org={deleteTarget}
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
