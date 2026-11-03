import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createGroupConfig,
  deleteGroupConfig,
  fetchGroupConfigById,
  fetchGroupConfigDetails,
  fetchGroupConfigDevices,
  fetchGroupConfigFirmwares,
  fetchGroupConfigModels,
  fetchGroupConfigOrganizations,
  fetchGroupConfigs,
  fetchGroupConfigTemplates,
  refreshGroupConfig,
  runGroupConfig,
  updateGroupConfig,
} from '../../../api/groupConfig';
import { getStoredSessionUser } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import GroupConfigTable from './components/GroupConfigTable';
import GroupConfigFormModal from './components/GroupConfigFormModal';
import GroupConfigViewModal from './components/GroupConfigViewModal';
import GroupConfigDeleteModal from './components/GroupConfigDeleteModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/template-creation.css';
import '../../../styles/group-config.css';

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_FORM = {
  id: '',
  act_name: '',
  act_type: 'config',
  orgId: '',
  model: '',
  templateFile: '',
  templateName: '',
  firmware: '',
  keep: true,
  force: false,
  selectedIds: [],
};

export default function GroupConfig({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [items, setItems] = useState([]);
  const [scopeOrgId, setScopeOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [runningId, setRunningId] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formInitial, setFormInitial] = useState(EMPTY_FORM);
  const [organizations, setOrganizations] = useState([]);
  const [models, setModels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [firmwares, setFirmwares] = useState([]);
  const [devices, setDevices] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTitle, setViewTitle] = useState('');
  const [viewItems, setViewItems] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const noticeTimer = useRef(null);

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

  const showNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  }, []);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const loadList = useCallback(async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchGroupConfigs();
      setItems(data.items || []);
      setScopeOrgId(data.orgId || '');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load group configs');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  async function loadLookups({ orgId, model, act_type, selectedIds = [] }) {
    setLookupsLoading(true);
    try {
      if (orgId) {
        const nextModels = await fetchGroupConfigModels(orgId);
        setModels(nextModels);
      } else {
        setModels([]);
      }

      if (!orgId || !model) {
        setTemplates([]);
        setFirmwares([]);
        setDevices([]);
        return;
      }

      if (act_type === 'upgrade') {
        const [nextFirmwares, nextDevices] = await Promise.all([
          fetchGroupConfigFirmwares(model),
          fetchGroupConfigDevices({ orgId, model, selectedIds }),
        ]);
        setFirmwares(nextFirmwares);
        setTemplates([]);
        setDevices(nextDevices);
      } else {
        const [nextTemplates, nextDevices] = await Promise.all([
          fetchGroupConfigTemplates(orgId, model),
          fetchGroupConfigDevices({ orgId, model, selectedIds }),
        ]);
        setTemplates(nextTemplates);
        setFirmwares([]);
        setDevices(nextDevices);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to load form data');
      setDevices([]);
    } finally {
      setLookupsLoading(false);
    }
  }

  async function openCreate() {
    setFormMode('create');
    setFormError('');
    setFormInitial(EMPTY_FORM);
    setTemplates([]);
    setFirmwares([]);
    setDevices([]);
    setModels([]);
    setFormOpen(true);
    setLookupsLoading(true);
    try {
      const orgs = await fetchGroupConfigOrganizations();
      setOrganizations(orgs);
      const presetOrg = scopeOrgId || (orgs.length === 1 ? orgs[0].id : '');
      setFormInitial({ ...EMPTY_FORM, orgId: presetOrg });
      if (presetOrg) {
        const nextModels = await fetchGroupConfigModels(presetOrg);
        setModels(nextModels);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to open create form');
    } finally {
      setLookupsLoading(false);
    }
  }

  async function openEdit(item) {
    setFormMode('edit');
    setFormError('');
    setFormInitial({ ...EMPTY_FORM, id: item.id, act_name: item.act_name || '' });
    setFormOpen(true);
    setLookupsLoading(true);
    try {
      const [cfgRes, orgs] = await Promise.all([
        fetchGroupConfigById(item.id),
        fetchGroupConfigOrganizations(),
      ]);
      setOrganizations(orgs);
      const cfg = cfgRes?.config || {};
      const selectedIds = cfgRes?.selectedIds || [];
      setFormInitial({
        id: item.id,
        act_name: cfg.act_name || '',
        act_type: cfg.act_type || 'config',
        orgId: cfg.orgId || '',
        model: cfg.model || '',
        templateFile: cfg.f_name || '',
        templateName: cfg.t_name || '',
        t_name: cfg.t_name || '',
        firmware: cfg.f_name || '',
        f_name: cfg.f_name || '',
        keep: Boolean(cfg.keep),
        force: Boolean(cfg.force),
        selectedIds,
      });
      await loadLookups({
        orgId: cfg.orgId,
        model: cfg.model,
        act_type: cfg.act_type || 'config',
        selectedIds,
      });
    } catch (err) {
      setFormError(err.message || 'Failed to load config');
    } finally {
      setLookupsLoading(false);
    }
  }

  async function handleFormSubmit(form) {
    setFormSaving(true);
    setFormError('');
    try {
      if (!form.act_name) throw new Error('Activity name is required');
      if (!form.selectedIds?.length) throw new Error('Select at least one device');

      if (formMode === 'edit') {
        await updateGroupConfig(form.id, {
          act_name: form.act_name,
          deviceIds: form.selectedIds,
        });
      } else {
        if (!form.orgId) throw new Error('Organization is required');
        if (!form.model) throw new Error('Model is required');
        if (form.act_type === 'config' && !form.templateFile) throw new Error('Template is required');
        if (form.act_type === 'upgrade' && !form.firmware) throw new Error('Firmware is required');
        await createGroupConfig({
          act_name: form.act_name,
          act_type: form.act_type,
          orgId: form.orgId,
          model: form.model,
          templateFile: form.templateFile,
          templateName: form.templateName,
          firmware: form.firmware,
          keep: form.keep,
          force: form.force,
          deviceIds: form.selectedIds,
        });
      }

      setFormOpen(false);
      await loadList({ soft: true });
    } catch (err) {
      setFormError(err.message || 'Failed to save group config');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleRun(item) {
    setRunningId(item.id);
    setError('');
    try {
      const result = await runGroupConfig(item.id, { retry: Number(item.runMode) === 1 });
      const ran = Number(result?.ran || 0);
      const failed = Number(result?.failed || 0);
      showNotice(
        failed
          ? `Started on ${ran} device${ran === 1 ? '' : 's'} · ${failed} failed to publish`
          : ran
            ? `Started on ${ran} device${ran === 1 ? '' : 's'}`
            : 'No devices to run'
      );
      await loadList({ soft: true });
    } catch (err) {
      setError(err.message || 'Failed to run group config');
    } finally {
      setRunningId('');
    }
  }

  async function handleRefresh(item) {
    setRefreshing(true);
    setError('');
    try {
      await refreshGroupConfig(item.id);
      await loadList({ soft: true });
    } catch (err) {
      setError(err.message || 'Failed to refresh status');
      setRefreshing(false);
    }
  }

  async function openView(item) {
    setViewOpen(true);
    setViewTitle(item.act_name || 'Activity details');
    setViewItems([]);
    setViewError('');
    setViewLoading(true);
    try {
      const rows = await fetchGroupConfigDetails(item.id);
      setViewItems(rows);
    } catch (err) {
      setViewError(err.message || 'Failed to load details');
    } finally {
      setViewLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteGroupConfig(deleteTarget.id);
      setDeleteTarget(null);
      await loadList({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete group config');
    } finally {
      setDeleting(false);
    }
  }

  const stats = useMemo(() => {
    const completed = items.filter((item) => String(item.act_status || '').toLowerCase().includes('complete')).length;
    const pending = items.reduce((sum, item) => sum + Number(item.pending || 0), 0);
    return { total: items.length, completed, pending };
  }, [items]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [items.length, page, pageSize]);

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
        <main className="dash-content dl-page tpl-page gc-page" aria-label="Group config">
          <section className="tpl-hero">
            <div>
              <p className="tpl-hero__eyebrow">Provisioning</p>
              <h2 className="tpl-hero__title">Group Config</h2>
              <p className="tpl-hero__meta">
                Apply a template or firmware upgrade to many devices in one activity, then track MQTT results.
              </p>
            </div>
            <div className="tpl-hero__stats">
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.total}</span>
                <span className="tpl-stat__label">Activities</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.completed}</span>
                <span className="tpl-stat__label">Completed</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : stats.pending}</span>
                <span className="tpl-stat__label">Pending devices</span>
              </div>
            </div>
          </section>

          {notice ? (
            <div className="om-counts">
              <div className="om-counts__row">
                <span className="om-counts__label">Status</span>
                <span className="om-counts__value">{notice}</span>
              </div>
            </div>
          ) : null}

          <GroupConfigTable
            items={pagedItems}
            loading={loading}
            error={error}
            total={items.length}
            page={page}
            pageSize={pageSize}
            runningId={runningId}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onCreate={openCreate}
            onRun={handleRun}
            onRefresh={handleRefresh}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onView={openView}
          />

          {formOpen ? (
            <GroupConfigFormModal
              mode={formMode}
              initial={formInitial}
              organizations={organizations}
              models={models}
              templates={templates}
              firmwares={firmwares}
              devices={devices}
              loadingLookups={lookupsLoading}
              saving={formSaving}
              error={formError}
              onClose={() => {
                if (!formSaving) {
                  setFormOpen(false);
                  setFormError('');
                }
              }}
              onSubmit={handleFormSubmit}
              onLookupsChange={loadLookups}
            />
          ) : null}

          {viewOpen ? (
            <GroupConfigViewModal
              title={viewTitle}
              items={viewItems}
              loading={viewLoading}
              error={viewError}
              onClose={() => {
                setViewOpen(false);
                setViewItems([]);
                setViewError('');
              }}
            />
          ) : null}

          {deleteTarget ? (
            <GroupConfigDeleteModal
              item={deleteTarget}
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
