import React from 'react';

export function CloudStatus() {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-nimbus-panel/80 px-3.5 py-1.5 text-[0.75rem] font-medium"
      role="status"
      aria-label="Cloud status operational"
    >
      <span className="relative flex h-2 w-2">
        <span className="nimbus-status-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="text-nimbus-muted">Cloud Status</span>
      <span className="text-white">Operational</span>
    </div>
  );
}
