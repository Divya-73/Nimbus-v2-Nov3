import React from 'react';
import { Activity, KeyRound, Layers, Rocket, ShieldCheck, Plug } from 'lucide-react';

const FEATURES = [
  { Icon: Rocket, title: 'Zero Touch Provisioning' },
  { Icon: Activity, title: 'Performance Monitoring' },
  { Icon: Layers, title: 'Multi-tenancy' },
  { Icon: KeyRound, title: 'Role based Management' },
  { Icon: Plug, title: 'API Integrations' },
  { Icon: ShieldCheck, title: 'Branch visibility' },
];

export function FeatureCards() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-center">
      {FEATURES.map(({ Icon, title }, index) => (
        <React.Fragment key={title}>
          {index > 0 ? <span className="mx-1.5 hidden text-slate-600 sm:inline" aria-hidden>·</span> : null}
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-slate-300">
            <Icon className="h-3 w-3 text-sky-400" strokeWidth={2} aria-hidden />
            {title}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
