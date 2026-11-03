import React from 'react';

export default function DevicePerformanceSkeleton() {
  return (
    <div className="dd-skeleton" aria-hidden>
      <div className="dd-skeleton__hero" />
      <div className="lp-place-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dd-skeleton__kpi" />
        ))}
      </div>
      <div className="dd-skeleton__panel" />
    </div>
  );
}
