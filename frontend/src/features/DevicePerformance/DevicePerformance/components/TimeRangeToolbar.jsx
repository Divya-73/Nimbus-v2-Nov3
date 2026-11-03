import React from 'react';
import { Info } from 'lucide-react';
import { TIME_PRESETS } from '../utils/chartTime';

export default function TimeRangeToolbar({
  info,
  extra,
  rangeAriaLabel = 'Time range',
  preset,
  applyPreset,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  applyRange,
  rangeError,
  loading,
}) {
  return (
    <div className="lp-health__toolbar">
      {info ? (
        <p className="lp-health__info">
          <Info size={14} aria-hidden />
          <span>{info}</span>
        </p>
      ) : null}
      {extra}
      <div className="lp-health__controls">
        <div className="lp-health__presets" role="group" aria-label={rangeAriaLabel}>
          {TIME_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lp-health__preset${preset === item.id ? ' is-active' : ''}`}
              onClick={() => applyPreset(item.id)}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="lp-health__custom">
          <label className="dl-field">
            <span className="dl-field__label">From</span>
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="dl-field">
            <span className="dl-field__label">To</span>
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              disabled={loading}
            />
          </label>
          <button
            type="button"
            className="dl-btn dl-btn--accent"
            onClick={applyRange}
            disabled={loading}
          >
            Apply
          </button>
        </div>
      </div>
      {rangeError ? <p className="lp-health__range-error">{rangeError}</p> : null}
    </div>
  );
}
