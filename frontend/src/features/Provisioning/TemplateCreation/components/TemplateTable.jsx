import React, { useMemo } from 'react';
import { Eye, FileCode2, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { getTemplateTypeMeta } from '../utils/templateOptions';

function TypeBadge({ value }) {
  const meta = getTemplateTypeMeta(value);
  const label = meta?.label || meta?.title || value || 'Unknown';
  const tone = meta?.tone || 'slate';
  return <span className={`tpl-badge tpl-badge--${tone}`}>{label}</span>;
}

function resolveOrgName(tpl, orgById) {
  const named = String(tpl?.orgName || tpl?.org || tpl?.org_name || '').trim();
  if (named && named !== String(tpl?.orgId || '').trim()) return named;
  const id = String(tpl?.orgId || '').trim();
  if (!id) return '—';
  return orgById.get(id) || id;
}

export default function TemplateTable({
  templates = [],
  organizations = [],
  loading,
  error,
  total,
  page,
  pageSize,
  selectedIds = [],
  canManage = false,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onEdit,
  onPreview,
  onDelete,
  onToggleSelect,
  onOpenMaster,
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const selectedCount = selectedIds.length;
  const orgById = useMemo(() => {
    const map = new Map();
    for (const org of organizations) {
      const id = String(org.id || org.org || '').trim();
      if (!id) continue;
      map.set(id, org.name || org.org_name || org.org || id);
    }
    return map;
  }, [organizations]);

  return (
    <section className="dash-panel tpl-table-panel">
      <header className="dash-panel__head">
        <div className="tpl-section-title">
          <span className="tpl-section-icon" aria-hidden>
            <FileCode2 size={16} />
          </span>
          <div>
            <h3 className="dash-panel__title">Templates</h3>
            <p className="dash-panel__meta">
              {loading ? 'Loading catalog…' : `${total || 0} template${total === 1 ? '' : 's'} available`}
              {canManage && selectedCount ? ` · ${selectedCount} selected for master` : ''}
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="dl-filters__actions">
            <button
              type="button"
              className={`dl-btn${selectedCount ? ' tpl-btn-master' : ''}`}
              onClick={onOpenMaster}
              disabled={!selectedCount}
              title={selectedCount ? 'Build master from selected' : 'Select at least two templates'}
            >
              <Layers size={14} />
              <span>Build master</span>
              {selectedCount ? <span className="tpl-count-chip">{selectedCount}</span> : null}
            </button>
            <button type="button" className="dl-btn dl-btn--accent" onClick={onCreate}>
              <Plus size={14} />
              <span>Create template</span>
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="dl-error">{error}</p> : null}
      {!canManage ? (
        <p className="dash-panel__meta" style={{ margin: '0 1.25rem 0.75rem' }}>
          View-only access. Template create, edit, and delete require an admin role.
        </p>
      ) : null}

      <div className="dl-table-scroll tpl-table-scroll">
        <table className="dl-table tpl-table">
          <thead>
            <tr>
              {canManage ? <th className="tpl-th-check" aria-label="Select" /> : null}
              <th>Name</th>
              <th>Type</th>
              <th>Model</th>
              <th>Organization</th>
              <th>Kind</th>
              <th className="tpl-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !templates.length ? (
              <tr>
                <td colSpan={canManage ? 7 : 6}>
                  <div className="tpl-state">
                    <div className="tpl-state__pulse" />
                    <p>Loading templates…</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {!loading && !templates.length ? (
              <tr>
                <td colSpan={canManage ? 7 : 6}>
                  <div className="tpl-state">
                    <FileCode2 size={28} strokeWidth={1.5} />
                    <p>No templates match these filters.</p>
                    {canManage ? (
                      <button type="button" className="dl-btn dl-btn--accent" onClick={onCreate}>
                        <Plus size={14} />
                        Create your first template
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}
            {templates.map((tpl) => {
              const id = tpl.id;
              const checked = selectedIds.includes(id);
              const disabledSelect = !!tpl.is_master;
              return (
                <tr key={id} className={checked ? 'tpl-row--selected' : undefined}>
                  {canManage ? (
                    <td className="tpl-th-check">
                      <input
                        type="checkbox"
                        className="tpl-check-input"
                        checked={checked}
                        disabled={disabledSelect}
                        onChange={() => onToggleSelect(tpl)}
                        aria-label={`Select ${tpl.temp_name || id}`}
                        title={disabledSelect ? 'Master templates cannot be combined' : undefined}
                      />
                    </td>
                  ) : null}
                  <td>
                    <div className="tpl-name-cell">
                      <strong>{tpl.temp_name || '—'}</strong>
                      {tpl.desc ? <span>{tpl.desc}</span> : null}
                    </div>
                  </td>
                  <td>
                    <TypeBadge value={tpl.temp_type} />
                  </td>
                  <td>
                    <code className="tpl-code">{tpl.model || '—'}</code>
                  </td>
                  <td className="om-cell-clip" title={tpl.orgId || ''}>
                    {resolveOrgName(tpl, orgById)}
                  </td>
                  <td>
                    {tpl.is_master ? (
                      <span className="tpl-pill tpl-pill--master">Master</span>
                    ) : (
                      <span className="tpl-pill">Single</span>
                    )}
                  </td>
                  <td className="tpl-th-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="dl-row-actions">
                      <button
                        type="button"
                        className="dl-icon-btn"
                        title="Preview"
                        aria-label={`Preview ${tpl.temp_name || id}`}
                        onClick={() => onPreview(tpl)}
                      >
                        <Eye size={14} />
                      </button>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="dl-icon-btn"
                            title="Edit"
                            aria-label={`Edit ${tpl.temp_name || id}`}
                            onClick={() => onEdit(tpl)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="dl-icon-btn om-icon-btn--danger"
                            title="Delete"
                            aria-label={`Delete ${tpl.temp_name || id}`}
                            onClick={() => onDelete(tpl)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="dl-pagination tpl-pagination">
        <div className="tpl-pagination__nav">
          <button type="button" className="dl-btn" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span className="dl-pagination__meta">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className="dl-btn"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
        <label className="dl-field dl-field--inline">
          <span className="dl-field__label">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
