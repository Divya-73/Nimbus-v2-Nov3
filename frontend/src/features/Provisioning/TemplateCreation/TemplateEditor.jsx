import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileCode2, Terminal } from 'lucide-react';
import { isAuthenticated, logout } from '../../../api/auth';
import {
  createTemplate,
  fetchTemplateById,
  fetchTemplateModels,
  fetchTemplateOrganizations,
  updateTemplate,
} from '../../../api/templates';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import { getTemplateFormComponent } from './components/formRegistry';
import { Field, TextInput, TextSelect } from './components/FormControls';
import { getTemplateTypeMeta } from './utils/templateOptions';
import { buildTemplateContent, getDefaultForm, normalizeLoadedFormValue, prepareTemplatePayload } from './utils/buildContent';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/org-management.css';
import '../../../styles/template-creation.css';

export default function TemplateEditor({ sidebarOpen: initialSidebar = true }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());

  const [organizations, setOrganizations] = useState([]);
  const [models, setModels] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [model, setModel] = useState('');
  const [desc, setDesc] = useState('');
  const [formValue, setFormValue] = useState(() => getDefaultForm('firewall'));

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const isSuperAdmin = hasRole(profile, ROLES.SUPER_ADMIN);
  const canManage =
    isSuperAdmin ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);
  const FormComponent = getTemplateFormComponent(formValue.ttype);
  const typeMeta = getTemplateTypeMeta(formValue.ttype);

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
    let cancelled = false;
    (async () => {
      try {
        const orgs = await fetchTemplateOrganizations();
        if (cancelled) return;
        setOrganizations(Array.isArray(orgs) ? orgs : []);
        if (!isSuperAdmin && orgs?.length === 1) {
          setOrgId((prev) => prev || orgs[0].id || '');
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load organizations');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchTemplateModels(orgId || undefined);
        if (!cancelled) setModels(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await fetchTemplateById(id);
        if (cancelled) return;
        const fv = normalizeLoadedFormValue(data);
        setFormValue({
          ...fv,
          desc: data.desc || fv.desc || '',
        });
        setOrgId(data.orgId || '');
        setModel(data.model || '');
        setDesc(data.desc || '');
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load template');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const preview = useMemo(() => {
    try {
      return buildTemplateContent(formValue.ttype || 'firewall', formValue);
    } catch {
      return { opts: [], stop: [], start: [], restart: [] };
    }
  }, [formValue]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleFormChange(next) {
    const prevType = formValue.ttype;
    const nextType = next.ttype;
    if (nextType && nextType !== prevType && !isEdit) {
      setFormValue({
        ...getDefaultForm(nextType),
        tempName: next.tempName || '',
        ttype: nextType,
        desc: next.desc || desc,
      });
      return;
    }
    setFormValue(next);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!canManage) {
        setError('You do not have permission to manage templates');
        return;
      }
      const payload = prepareTemplatePayload({
        formValue: { ...formValue, desc },
        orgId,
        model,
      });
      if (isEdit) {
        await updateTemplate(id, {
          temp_name: payload.temp_name,
          temp_type: payload.temp_type,
          model: payload.model,
          desc: payload.desc,
          content: payload.content,
          formValue: payload.formValue,
        });
      } else {
        await createTemplate(payload);
      }
      navigate('/provisioning/template-creation');
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!canManage) {
    return <Navigate to="/provisioning/template-creation" replace />;
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
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />
      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />
      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page tpl-page" aria-label="Template editor">
          <section className="tpl-hero">
            <div>
              <p className="tpl-hero__eyebrow">Template editor</p>
              <h2 className="tpl-hero__title">{isEdit ? 'Edit template' : 'Create template'}</h2>
              <p className="tpl-hero__meta">
                Configure fields for a template type, then review the generated UCI commands before saving.
              </p>
            </div>
            <div className="tpl-hero__actions">
              {typeMeta ? (
                <div className="tpl-chip">
                  <span className="tpl-chip__label">Type</span>
                  <span className={`tpl-badge tpl-badge--${typeMeta.tone}`}>{typeMeta.label}</span>
                </div>
              ) : null}
              <div className="tpl-chip">
                <span className="tpl-chip__label">Commands</span>
                <strong className="tpl-chip__value">{preview.opts?.length || 0}</strong>
              </div>
              <button
                type="button"
                className="dl-btn"
                onClick={() => navigate('/provisioning/template-creation')}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            </div>
          </section>

          <section className="dash-panel">
            {loadError ? <p className="dl-error">{loadError}</p> : null}
            {loading ? (
              <div className="tpl-state">
                <div className="tpl-state__pulse" />
                <p>Loading template…</p>
              </div>
            ) : null}

            {!loading && !loadError ? (
              <form className="tpl-editor" onSubmit={handleSave}>
                <div className="tpl-editor__shell">
                  <div className="tpl-editor__meta-card">
                    <h4>Target</h4>
                    <p>Organization, model, and description for this template</p>
                    <div className="tpl-grid tpl-editor__meta">
                      <Field label="Organization">
                        <TextSelect
                          value={orgId}
                          disabled={isEdit || (!isSuperAdmin && organizations.length <= 1)}
                          placeholder="Select organization"
                          options={organizations.map((org) => ({
                            value: org.id,
                            title: org.name || org.id,
                          }))}
                          onChange={(e) => {
                            setOrgId(e.target.value);
                            setModel('');
                          }}
                          required
                        />
                      </Field>
                      <Field label="Model">
                        <TextSelect
                          value={model}
                          disabled={isEdit}
                          placeholder="Select model"
                          options={models}
                          onChange={(e) => setModel(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Description" full>
                        <TextInput
                          value={desc}
                          placeholder="Short note for operators (optional)"
                          onChange={(e) => setDesc(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="tpl-editor__body">
                    <div className="tpl-editor__form">
                      <div className="tpl-editor__form-head">
                        <div className="tpl-section-title">
                          <span className="tpl-section-icon" aria-hidden>
                            <FileCode2 size={16} />
                          </span>
                          <div>
                            <h4>Configuration</h4>
                            <p>Type-specific fields used to build template content</p>
                          </div>
                        </div>
                      </div>
                      <div className="tpl-editor__form-body">
                        <FormComponent value={formValue} onChange={handleFormChange} lockedType={isEdit} />
                      </div>
                    </div>

                    <aside className="tpl-editor__preview">
                      <div className="tpl-editor__preview-head">
                        <div className="tpl-section-title">
                          <span className="tpl-section-icon" aria-hidden>
                            <Terminal size={16} />
                          </span>
                          <div>
                            <h4>Live preview</h4>
                            <p>Updates as you edit</p>
                          </div>
                        </div>
                      </div>
                      <div className="tpl-editor__preview-body">
                        <div className="tpl-preview-metrics">
                          <div className="tpl-metric">
                            <strong>{preview.opts?.length || 0}</strong>
                            <span>opts</span>
                          </div>
                          <div className="tpl-metric">
                            <strong>{preview.stop?.length || 0}</strong>
                            <span>stop</span>
                          </div>
                          <div className="tpl-metric">
                            <strong>{preview.start?.length || 0}</strong>
                            <span>start</span>
                          </div>
                        </div>
                        <section className="tpl-preview-block">
                          <h5>opts</h5>
                          <pre className={`tpl-preview-pre${preview.opts?.length ? '' : ' tpl-preview-pre--empty'}`}>
                            {(preview.opts || []).join('\n') || '(empty)'}
                          </pre>
                        </section>
                        <section className="tpl-preview-block">
                          <h5>stop / start</h5>
                          <pre className="tpl-preview-pre">
                            {[
                              ...(preview.stop || []).map((s) => `stop: ${s}`),
                              ...(preview.start || []).map((s) => `start: ${s}`),
                            ].join('\n') || '(empty)'}
                          </pre>
                        </section>
                      </div>
                    </aside>
                  </div>
                </div>

                {error ? <p className="dl-error">{error}</p> : null}

                <div className="tpl-editor__actions">
                  <button
                    type="button"
                    className="dl-btn"
                    disabled={saving}
                    onClick={() => navigate('/provisioning/template-creation')}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="dl-btn dl-btn--accent" disabled={saving}>
                    {saving ? 'Saving…' : isEdit ? 'Update template' : 'Create template'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
