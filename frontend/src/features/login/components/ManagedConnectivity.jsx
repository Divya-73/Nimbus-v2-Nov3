import React from 'react';
import { Cpu, Network, Router, Wifi } from 'lucide-react';

const SERVICES = [
  { id: 'wan', title: 'Managed WAN', Icon: Network, caption: 'Branches & underlays' },
  { id: 'lan', title: 'Managed LAN', Icon: Router, caption: 'Switching & segments' },
  { id: 'wifi', title: 'Managed WiFi', Icon: Wifi, caption: 'Access & clients' },
  { id: 'iot', title: 'Managed IoT', Icon: Cpu, caption: 'Sensors & gateways' },
];

export function ManagedConnectivity() {
  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      {SERVICES.map(({ id, title, Icon, caption }) => (
        <article
          key={id}
          className="group flex items-start gap-3 rounded-[0.875rem] border border-white/10 bg-white/[0.04] px-3.5 py-3 transition duration-300 hover:border-sky-400/30 hover:bg-white/[0.07]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-sky-500/15 text-sky-300">
            <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-[0.75rem] font-semibold text-white xl:text-[0.8125rem]">{title}</h3>
            <p className="mt-0.5 truncate text-[0.625rem] text-slate-400 xl:text-[0.6875rem]">{caption}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
