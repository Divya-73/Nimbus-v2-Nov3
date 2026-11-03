import React from 'react';
import { X } from 'lucide-react';
import { getTemplateTypeMeta } from '../utils/templateOptions';

function CommandBlock({ title, lines = [] }) {
  return (
    <section className="tpl-preview-block">
      <div className="tpl-preview-block__head">
        <h4>{title}</h4>
        <span>{lines.length}</span>
      </div>
      {!lines.length ? (
        <pre className="tpl-preview-pre tpl-preview-pre--empty">(empty)</pre>
      ) : (
        <pre className="tpl-preview-pre">{lines.join('\n')}</pre>
      )}
    </section>
  );
}

export default function TemplatePreviewModal({ template, content, loading, error, onClose }) {
  const payload = content || template?.content || {};
  const opts = Array.isArray(payload.opts) ? payload.opts : [];
  const stop = Array.isArray(payload.stop) ? payload.stop : [];
  const start = Array.isArray(payload.start) ? payload.start : [];
  const restart = Array.isArray(payload.restart) ? payload.restart : [];
  const typeMeta = getTemplateTypeMeta(template?.temp_type);

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-label="Template preview">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card tpl-modal-wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 className="dl-gui-modal__title">{template?.temp_name || 'Template preview'}</h3>
            <p className="dl-gui-modal__sub">
              {typeMeta ? (
                <span className={`tpl-badge tpl-badge--${typeMeta.tone}`}>{typeMeta.label}</span>
              ) : (
                template?.temp_type || '—'
              )}{' '}
              · {template?.model || '—'}
            </p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {loading ? (
          <div className="tpl-state">
            <div className="tpl-state__pulse" />
            <p>Loading content…</p>
          </div>
        ) : null}
        {error ? <p className="dl-error">{error}</p> : null}

        {!loading && !error ? (
          <div className="tpl-preview-grid">
            <CommandBlock title="opts" lines={opts} />
            <CommandBlock title="stop" lines={stop} />
            <CommandBlock title="start" lines={start} />
            <CommandBlock title="restart" lines={restart} />
            {Array.isArray(payload.trunc) && payload.trunc.length ? (
              <CommandBlock title="trunc" lines={payload.trunc} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
