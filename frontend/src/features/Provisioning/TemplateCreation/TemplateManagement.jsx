import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createMasterTemplate,
  deleteTemplate,
  fetchTemplateById,
  fetchTemplateModels,
  fetchTemplateOrganizations,
  fetchTemplates,
} from '../../../api/templates';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import TemplateFilters from './components/TemplateFilters';
import TemplateTable from './components/TemplateTable';
import TemplatePreviewModal from './components/TemplatePreviewModal';
import MasterTemplateModal from './components/MasterTemplateModal';
import TemplateDeleteModal from './components/TemplateDeleteModal';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/template-creation.css';

const DEFAULT_PAGE_SIZE = 10;

export default function TemplateManagement({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [organizations, setOrganizations] = useState([]);
  const [models, setModels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [selected, setSelected] = useState([]);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [masterOpen, setMasterOpen] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterError, setMasterError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const searchDebounceRef = useRef(null);
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
    try {
      const data = await fetchTemplateOrganizations();
      setOrganizations(Array.isArray(data) ? data : []);
      if (!isSuperAdmin && data?.length === 1) {
        setOrgId((prev) => prev || data[0].id || '');
      }
    } catch (err) {
      setOrganizations([]);
      setError(err.message || 'Failed to load organizations');
    }
  }, [isSuperAdmin]);

  const loadModels = useCallback(async () => {
    try {
      const data = await fetchTemplateModels(orgId || undefined);
      setModels(Array.isArray(data) ? data : []);
    } catch {
      setModels([]);
    }
  }, [orgId]);

  const loadTemplates = useCallback(
    async ({ soft = false } = {}) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await fetchTemplates({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          orgId: isSuperAdmin ? orgId || undefined : undefined,
          model: model || undefined,
          type: type || undefined,
        });
        setTemplates(data.templates || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || 'Failed to load templates');
        setTemplates([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, isSuperAdmin, model, orgId, page, pageSize, type]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

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
      setModel('');
      setSelected([]);
      setPage(1);
    }
    if (key === 'model') {
      setModel(value);
      setSelected([]);
      setPage(1);
    }
    if (key === 'type') {
      setType(value);
      setPage(1);
    }
  }

  function handleClear() {
    setSearch('');
    setDebouncedSearch('');
    setOrgId(isSuperAdmin ? '' : orgId);
    setModel('');
    setType('');
    setPage(1);
    setSelected([]);
  }

  function toggleSelect(tpl) {
    if (!canManage || tpl.is_master) return;
    setSelected((prev) => {
      const exists = prev.find((item) => item.id === tpl.id);
      if (exists) return prev.filter((item) => item.id !== tpl.id);
      if (prev.length) {
        const first = prev[0];
        if (String(first.model || '') !== String(tpl.model || '')) {
          setError('Master selection must use templates from the same model');
          return prev;
        }
        if (String(first.orgId || '') !== String(tpl.orgId || '')) {
          setError('Master selection must use templates from the same organization');
          return prev;
        }
      }
      setError('');
      return [...prev, tpl];
    });
  }

  async function openPreview(tpl) {
    setPreviewTarget(tpl);
    setPreviewContent(null);
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const data = await fetchTemplateById(tpl.id);
      setPreviewContent(data.content || null);
      setPreviewTarget(data);
    } catch (err) {
      setPreviewError(err.message || 'Failed to load template');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleMasterSubmit(payload) {
    if (!canManage) return;
    setMasterSaving(true);
    setMasterError('');
    try {
      await createMasterTemplate(payload);
      setMasterOpen(false);
      setSelected([]);
      await loadTemplates({ soft: true });
    } catch (err) {
      setMasterError(err.message || 'Failed to create master template');
    } finally {
      setMasterSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!canManage || !deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTemplate(deleteTarget.id);
      setSelected((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      await loadTemplates({ soft: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  }

  const selectedIds = useMemo(() => selected.map((item) => item.id), [selected]);

  const masterContext = useMemo(() => {
    if (!selected.length) return { orgId: '', model: '' };
    return {
      orgId: selected[0].orgId || orgId,
      model: selected[0].model || model,
    };
  }, [model, orgId, selected]);

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
        onRefresh={() => loadTemplates({ soft: true })}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page tpl-page" aria-label="Template creation">
          <section className="tpl-hero">
            <div>
              <p className="tpl-hero__eyebrow">Provisioning</p>
              <h2 className="tpl-hero__title">Template Creation</h2>
              <p className="tpl-hero__meta">
                Design device config templates, preview UCI commands, and combine singles into master templates.
              </p>
            </div>
            <div className="tpl-hero__stats">
              <div className="tpl-stat">
                <span className="tpl-stat__value">{loading ? '—' : total}</span>
                <span className="tpl-stat__label">Templates</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{selected.length}</span>
                <span className="tpl-stat__label">Selected</span>
              </div>
              <div className="tpl-stat">
                <span className="tpl-stat__value">{models.length || '—'}</span>
                <span className="tpl-stat__label">Models</span>
              </div>
            </div>
          </section>

          <TemplateFilters
            search={search}
            orgId={orgId}
            model={model}
            type={type}
            organizations={organizations}
            models={models}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={() => loadTemplates({ soft: true })}
            onClear={handleClear}
          />

          <TemplateTable
            templates={templates}
            organizations={organizations}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            selectedIds={selectedIds}
            canManage={canManage}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onCreate={() => navigate('/provisioning/template-creation/new')}
            onEdit={(tpl) => navigate(`/provisioning/template-creation/${encodeURIComponent(tpl.id)}/edit`)}
            onPreview={openPreview}
            onDelete={setDeleteTarget}
            onToggleSelect={toggleSelect}
            onOpenMaster={() => {
              setMasterError('');
              setMasterOpen(true);
            }}
          />

          {previewTarget ? (
            <TemplatePreviewModal
              template={previewTarget}
              content={previewContent}
              loading={previewLoading}
              error={previewError}
              onClose={() => {
                setPreviewTarget(null);
                setPreviewContent(null);
                setPreviewError('');
              }}
            />
          ) : null}

          {canManage && masterOpen ? (
            <MasterTemplateModal
              selectedTemplates={selected}
              orgId={masterContext.orgId}
              model={masterContext.model}
              saving={masterSaving}
              error={masterError}
              onClose={() => {
                if (!masterSaving) {
                  setMasterOpen(false);
                  setMasterError('');
                }
              }}
              onSubmit={handleMasterSubmit}
            />
          ) : null}

          {canManage && deleteTarget ? (
            <TemplateDeleteModal
              template={deleteTarget}
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
