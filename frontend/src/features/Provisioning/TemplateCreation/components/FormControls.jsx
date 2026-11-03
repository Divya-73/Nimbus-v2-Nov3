import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export function Field({ label, children, full = false, hint }) {
  return (
    <label className={`tpl-field${full ? ' tpl-field--full' : ''}`}>
      <span className="tpl-field__label">{label}</span>
      {children}
      {hint ? <span className="tpl-field__hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props) {
  return <input className="tpl-input" {...props} />;
}

export function TextSelect({ options = [], placeholder, ...props }) {
  return (
    <select className="tpl-select" {...props}>
      {placeholder != null ? <option value="">{placeholder}</option> : null}
      {options.map((opt) => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          return (
            <option key={String(opt)} value={opt}>
              {opt}
            </option>
          );
        }
        return (
          <option key={String(opt.value)} value={opt.value}>
            {opt.title || opt.label || opt.value}
          </option>
        );
      })}
    </select>
  );
}

export function TextCheckbox({ label, checked, onChange }) {
  return (
    <label className={`tpl-check${checked ? ' is-on' : ''}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function ArraySection({ title, items = [], onAdd, onRemove, renderItem, addLabel = 'Add item' }) {
  return (
    <section className="tpl-array">
      <div className="tpl-array__head">
        <div>
          <h4>{title}</h4>
          <p className="tpl-array__count">{items.length} item{items.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" className="dl-btn" onClick={onAdd}>
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
      {!items.length ? (
        <div className="tpl-empty-soft">
          <span>Nothing here yet. Use the add button above.</span>
        </div>
      ) : null}
      {items.map((item, index) => (
        <div key={index} className="tpl-array__card">
          <div className="tpl-array__card-head">
            <span className="tpl-array__index">#{index + 1}</span>
            <button
              type="button"
              className="dl-icon-btn om-icon-btn--danger"
              title="Remove"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="tpl-grid">{renderItem(item, index)}</div>
        </div>
      ))}
    </section>
  );
}
