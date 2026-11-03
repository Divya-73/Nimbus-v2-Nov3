import React, { useEffect, useRef } from 'react';
import { Columns3 } from 'lucide-react';
import { ALARM_COLUMNS } from '../utils/columnConfig';

export default function AlarmColumnPicker({
  open,
  visibleIds,
  onChange,
  onOpenToggle,
  onClose,
  onResetDefault,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  const visible = new Set(visibleIds);

  const toggle = (id, locked) => {
    if (locked) return;
    let next = visible.has(id)
      ? visibleIds.filter((x) => x !== id)
      : [...visibleIds, id];
    if (!next.includes('startTime')) next = ['startTime', ...next];
    onChange(next);
  };

  return (
    <div className="lp-col-picker" ref={panelRef}>
      <button
        type="button"
        className="dl-btn"
        onClick={onOpenToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Columns3 size={14} />
        Columns
      </button>

      {open ? (
        <div className="lp-col-picker__panel" role="dialog" aria-label="Choose table columns">
          <header className="lp-col-picker__head">
            <strong>Visible columns</strong>
            <div className="lp-col-picker__head-actions">
              <button
                type="button"
                className="dl-btn"
                onClick={() => onChange(ALARM_COLUMNS.map((c) => c.id))}
              >
                All
              </button>
              <button type="button" className="dl-btn" onClick={onResetDefault}>
                Default
              </button>
            </div>
          </header>
          <ul className="lp-col-picker__list">
            {ALARM_COLUMNS.map((col) => (
              <li key={col.id}>
                <label
                  className={col.locked ? 'lp-col-picker__item is-locked' : 'lp-col-picker__item'}
                >
                  <input
                    type="checkbox"
                    checked={visible.has(col.id)}
                    disabled={col.locked}
                    onChange={() => toggle(col.id, col.locked)}
                  />
                  <span>{col.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
