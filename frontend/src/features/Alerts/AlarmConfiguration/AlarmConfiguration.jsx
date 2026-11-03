import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createAlarmPolicy,
  deleteAlarmPolicy,
  fetchAlarmPolicies,
  updateAlarmPolicy,
} from '../../../api/alarmConfiguration';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import AlarmConfigTable from './components/AlarmConfigTable';
import AlarmConfigFormModal from './components/AlarmConfigFormModal';
import AlarmConfigDeleteModal from './components/AlarmConfigDeleteModal';
import { EMPTY_POLICY, policyFromApi, toBool } from './policyForm';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/template-creation.css';
import '../../../styles/alarm-configuration.css';

const DEFAULT_PAGE_SIZE = 10;

export default function AlarmConfiguration({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formInitial, setFormInitial] = useState(EMPTY_POLICY);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const searchTimer = useRef(null);
  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const canManage =
    isSuperAdmin ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);

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
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const loadPolicies = useCallback(async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchAlarmPolicies({ page: 1, pageSize: 200 });
      setPolicies(data.policies || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load alarm policies');
      setPolicies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function openCreate() {
    setFormMode('create');
    setFormInitial(EMPTY_POLICY);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(policy) {
    setFormMode('edit');
    setFormInitial(policyFromApi(policy));
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    if (!canManage) return;
    setFormSaving(true);
    setFormError('');
    try {
      if (!payload.policy_name) throw new Error('Policy name is required');
      if (!payload.include?.length) throw new Error('Select at least one device');
      if (formMode === 'edit') {
        await updateAlarmPolicy(formInitial.id, payload);
      } else {
        await createAlarmPolicy(payload);
      }
      setFormOpen(false);
      await loadPolicies({ soft: true });
    } catch (err) {
      setFormError(err.message || 'Failed to save alarm policy');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAlarmPolicy(deleteTarget.id);
      setDeleteTarget(null);
      await loadPolicies({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete alarm policy');
    } finally {
      setDeleting(false);
    }
  }

  const filteredPolicies = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    if (!term) return policies;
    return policies.filter((policy) => String(policy.policy_name || '').toLowerCase().includes(term));
  }, [debouncedSearch, policies]);

  const pagedPolicies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPolicies.slice(start, start + pageSize);
  }, [filteredPolicies, page, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredPolicies.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredPolicies.length, page, pageSize]);

  const stats = useMemo(() => {
    const enabled = policies.filter((policy) => toBool(policy.enpolicy ?? 1)).length;
    const devicesCovered = policies.reduce(
      (sum, policy) => sum + (Array.isArray(policy.include) ? policy.include.length : 0),
      0
    );
    return { total: policies.length, enabled, devicesCovered };
  }, [policies]);

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
        onRefresh={() => loadPolicies({ soft: true })}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page tpl-page ac-page" aria-label="Alarm configuration">
          <section className="tpl-hero">
            <div>
              <p className="tpl-hero__eyebrow">Alerts</p>
              <h2 className="tpl-hero__title">Alarm Configuration</h2>
              <p className="tpl-hero__meta">
                Define which assigned devices raise alarms for reachability, health, links, and LTE.
              </p>
            </div>
            <div className="tpl-hero__stats">
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.total}</span>
                <span className="tpl-stat__label">Policies</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.enabled}</span>
                <span className="tpl-stat__label">Enabled</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.devicesCovered}</span>
                <span className="tpl-stat__label">Device slots</span>
              </div>
            </div>
          </section>

          <section className="dash-panel dl-filters">
            <header className="dash-panel__head">
              <div>
                <h3 className="dash-panel__title">Filters</h3>
                <p className="dash-panel__meta">Search by policy name</p>
              </div>
            </header>
            <div className="dl-filters__grid">
              <label className="dl-field">
                <span className="dl-field__label">Search</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Policy name"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          </section>

          <AlarmConfigTable
            policies={pagedPolicies}
            loading={loading}
            error={error}
            total={filteredPolicies.length}
            page={page}
            pageSize={pageSize}
            canManage={canManage}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onCreate={openCreate}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />

          {formOpen ? (
            <AlarmConfigFormModal
              mode={formMode}
              initial={formInitial}
              isSuperAdmin={isSuperAdmin}
              saving={formSaving}
              error={formError}
              onClose={() => {
                if (!formSaving) {
                  setFormOpen(false);
                  setFormError('');
                }
              }}
              onSubmit={handleFormSubmit}
            />
          ) : null}

          {deleteTarget ? (
            <AlarmConfigDeleteModal
              policy={deleteTarget}
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
        </main>
        <Footer />
      </div>
    </div>
  );
}
