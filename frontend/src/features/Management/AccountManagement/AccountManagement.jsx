import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
} from '../../../api/accounts';
import { fetchManagedOrgs } from '../../../api/orgs';
import { fetchManagedBranches } from '../../../api/branches';
import {
  getStoredSessionUser,
  hasRole,
  ROLES,
} from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import AccountManageFilters from './components/AccountManageFilters';
import AccountManageTable from './components/AccountManageTable';
import AccountFormModal from './components/AccountFormModal';
import AccountDeleteModal from './components/AccountDeleteModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 25;

export default function AccountManagement({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const isOrgAdmin = hasRole(profile, ROLES.ORG_ADMIN);
  const canManage = isSuperAdmin || isOrgAdmin;
  const lockedOrgId = !isSuperAdmin ? String(profile?.orgId || '').trim() : '';
  const currentUserId = String(profile?.userId || profile?.id || profile?._id || '').trim();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState([]);
  const [formBranches, setFormBranches] = useState([]);
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const searchDebounceRef = useRef(null);

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
            org: profile?.org || '',
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
      setFormBranches([]);
      return;
    }
    try {
      const data = await fetchManagedBranches({
        orgId: id,
        page: 1,
        pageSize: 500,
      });
      setFormBranches(data.branches || []);
    } catch {
      setFormBranches([]);
    }
  }, []);

  const loadAccounts = useCallback(
    async ({ soft = false } = {}) => {
      if (!canManage) {
        setLoading(false);
        return;
      }
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchAccounts({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          orgId: isSuperAdmin ? (orgId || undefined) : lockedOrgId || undefined,
          role: role || undefined,
          // Keep "0" (inactive) — do not use `active || undefined`
          active: active === '' ? undefined : active,
        });
        setAccounts(data.accounts || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load accounts');
        setAccounts([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      active,
      canManage,
      debouncedSearch,
      isSuperAdmin,
      lockedOrgId,
      orgId,
      page,
      pageSize,
      role,
    ]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFilterChange(key, value) {
    if (key === 'search') setSearch(value);
    if (key === 'orgId') {
      setOrgId(value);
      setPage(1);
    }
    if (key === 'role') {
      setRole(value);
      setPage(1);
    }
    if (key === 'active') {
      setActive(value);
      setPage(1);
    }
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setOrgId('');
    setRole('');
    setActive('');
    setPage(1);
  }

  function openCreate() {
    setFormMode('create');
    setEditing(null);
    setFormError('');
    setFormOpen(true);
    loadBranchesForOrg(lockedOrgId || '');
  }

  function openEdit(account) {
    setFormMode('edit');
    setEditing(account);
    setFormError('');
    setFormOpen(true);
    loadBranchesForOrg(account.orgId || lockedOrgId || '');
  }

  async function handleFormSubmit(payload) {
    setFormSaving(true);
    setFormError('');
    try {
      if (formMode === 'edit' && editing?.id) {
        await updateAccount(editing.id, payload);
      } else {
        await createAccount(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await loadAccounts({ soft: true });
    } catch (err) {
      setFormError(err.message || 'Failed to save account');
    } finally {
      setFormSaving(false);
    }
  }

  function openDelete(account) {
    setDeleteTarget(account);
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
      await loadAccounts({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
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
        onRefresh={canManage ? () => loadAccounts({ soft: true }) : undefined}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Account management">
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
            <h3 className="dash-panel__title">Account Management</h3>
            <p className="dash-panel__meta">Create, update, and delete user accounts</p>
          </div>
        </header>
        <p className="dl-error">Org admin or super admin access is required to manage accounts.</p>
      </section>
    );
  }

  return shell(
    <>
      <AccountManageFilters
        search={search}
        orgId={orgId}
        role={role}
        active={active}
        organizations={organizations}
        isSuperAdmin={isSuperAdmin}
        loading={loading || refreshing}
        onChange={handleFilterChange}
        onRefresh={async () => {
          await Promise.all([loadOrganizations(), loadAccounts({ soft: true })]);
        }}
        onClear={handleClear}
      />

      <AccountManageTable
        accounts={accounts}
        orgMap={orgMap}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={pageSize}
        currentUserId={currentUserId}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      {formOpen ? (
        <AccountFormModal
          mode={formMode}
          initial={editing}
          organizations={organizations}
          branches={formBranches}
          isSuperAdmin={isSuperAdmin}
          lockedOrgId={lockedOrgId}
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
          onOrgChange={loadBranchesForOrg}
        />
      ) : null}

      {deleteTarget ? (
        <AccountDeleteModal
          account={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError('');
            }
          }}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </>
  );
}
