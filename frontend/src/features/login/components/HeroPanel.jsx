import React from 'react';
import { CloudStatus } from './CloudStatus';
import { FeatureCards } from './FeatureCards';
import { ManagedConnectivity } from './ManagedConnectivity';
import { NetworkTopology } from './NetworkTopology';

export function HeroPanel() {
  return (
    <aside className="relative hidden h-[100dvh] w-full flex-col overflow-hidden lg:flex lg:w-[58%]">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#061529_0%,#0a2348_48%,#071a35_100%)]" aria-hidden />
      <div
        className="pointer-events-none absolute top-[-10%] right-[-8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.22),transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-15%] left-[10%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.12),transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col px-8 py-8 xl:px-11 xl:py-9">
        <div className="flex shrink-0 items-start justify-between gap-6">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-sky-300 uppercase">
              Systrome Managed Networks
            </p>
            <h2 className="mt-2.5 text-[1.875rem] leading-[1.1] font-bold tracking-tight text-white xl:text-[2.25rem]">
              Nimbus SD-WAN Cloud
            </h2>
            <p className="mt-2.5 max-w-[27.5rem] text-[0.875rem] leading-relaxed text-slate-300">
              One console for WAN, LAN, WiFi and IoT — provision, monitor and secure every site.
            </p>
          </div>
          <CloudStatus />
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgba(8,28,56,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm xl:mt-7">
          <div className="min-h-0 flex-1 px-4 pt-4 xl:px-5 xl:pt-5">
            <NetworkTopology />
          </div>
          <div className="shrink-0 border-t border-white/10 px-4 py-3.5 xl:px-5 xl:py-4">
            <ManagedConnectivity />
          </div>
        </div>

        <div className="mt-5 shrink-0 xl:mt-6">
          <FeatureCards />
        </div>
      </div>
    </aside>
  );
}
