import React, { useId } from 'react';
import { Building2, Cloud, Cpu, Router, Server, Shield, Wifi } from 'lucide-react';

const HUB = { x: 400, y: 175 };
const NODES = [
  { id: 'hq', x: 130, y: 78, Icon: Building2, label: 'HQ', delay: '0s', status: 'up' },
  { id: 'cloud', x: 400, y: 46, Icon: Cloud, label: 'Cloud', delay: '0.15s', status: 'up' },
  { id: 'branch', x: 670, y: 78, Icon: Building2, label: 'Branch', delay: '0.3s', status: 'up' },
  { id: 'wan', x: 88, y: 188, Icon: Router, label: 'WAN', delay: '0.45s', status: 'up' },
  { id: 'lan', x: 712, y: 188, Icon: Server, label: 'LAN', delay: '0.6s', status: 'up' },
  { id: 'wifi', x: 158, y: 298, Icon: Wifi, label: 'WiFi', delay: '0.75s', status: 'up' },
  { id: 'sec', x: 400, y: 316, Icon: Shield, label: 'Security', delay: '0.9s', status: 'up' },
  { id: 'iot', x: 642, y: 298, Icon: Cpu, label: 'IoT', delay: '1.05s', status: 'up' },
];

function curve(x1, y1, x2, y2, bend = 0.14) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M ${x1} ${y1} Q ${mx - dy * bend} ${my + dx * bend} ${x2} ${y2}`;
}

export function NetworkTopology() {
  const uid = useId().replace(/:/g, '');

  return (
    <div className="relative h-full min-h-[13.75rem] w-full">
      {/* ambient field */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(125,211,252,0.65) 1px, transparent 0)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse at 50% 48%, black 22%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 48%, black 22%, transparent 74%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.28),transparent_70%)]"
        aria-hidden
      />

      <svg viewBox="0 0 800 360" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-flow`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="45%" stopColor="#7dd3fc" stopOpacity="1" />
            <stop offset="55%" stopColor="#bae6fd" stopOpacity="1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-hub`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base glow tunnels */}
        {NODES.map((node, i) => {
          const d = curve(HUB.x, HUB.y, node.x, node.y, i % 2 === 0 ? 0.13 : -0.13);
          return (
            <path
              key={`glow-${node.id}`}
              d={d}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.18"
              filter={`url(#${uid}-soft)`}
            />
          );
        })}

        {/* solid faint rails */}
        {NODES.map((node, i) => {
          const d = curve(HUB.x, HUB.y, node.x, node.y, i % 2 === 0 ? 0.13 : -0.13);
          return (
            <path
              key={`rail-${node.id}`}
              d={d}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.28"
            />
          );
        })}

        {/* animated flow dashes */}
        {NODES.map((node, i) => {
          const d = curve(HUB.x, HUB.y, node.x, node.y, i % 2 === 0 ? 0.13 : -0.13);
          return (
            <path
              key={`flow-${node.id}`}
              d={d}
              fill="none"
              stroke={`url(#${uid}-flow)`}
              strokeWidth="2"
              strokeDasharray="7 10"
              strokeLinecap="round"
              className="nimbus-link-flow"
              style={{ animationDelay: node.delay, animationDuration: `${1.8 + (i % 3) * 0.25}s` }}
            />
          );
        })}

        {/* traveling packets */}
        {NODES.map((node, i) => {
          const d = curve(HUB.x, HUB.y, node.x, node.y, i % 2 === 0 ? 0.13 : -0.13);
          return (
            <g key={`pkt-${node.id}`}>
              <circle r="3.2" fill="#e0f2fe" filter={`url(#${uid}-glow)`}>
                <animateMotion
                  dur={`${2.4 + (i % 4) * 0.35}s`}
                  begin={node.delay}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
              <circle r="1.4" fill="#38bdf8">
                <animateMotion
                  dur={`${2.4 + (i % 4) * 0.35}s`}
                  begin={node.delay}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            </g>
          );
        })}

        {/* hub rings */}
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r="68"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="1"
          className="nimbus-node-pulse nimbus-delay-3"
          opacity="0.2"
        />
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r="50"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.2"
          className="nimbus-node-pulse nimbus-delay-2"
          opacity="0.35"
        />
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r="34"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.4"
          className="nimbus-node-pulse"
          opacity="0.55"
        />

        {/* hub core */}
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r="26"
          fill={`url(#${uid}-hub)`}
          stroke="#bfdbfe"
          strokeWidth="1.75"
          filter={`url(#${uid}-glow)`}
        />
        <circle cx={HUB.x} cy={HUB.y} r="10" fill="#eff6ff" opacity="0.95" />
        <circle cx={HUB.x} cy={HUB.y} r="4.5" fill="#2563eb" />

        <text
          x={HUB.x}
          y={HUB.y + 48}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize="12"
          fontWeight="700"
          fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
        >
          Nimbus Cloud
        </text>
      </svg>

      {/* endpoint nodes */}
      {NODES.map((node) => {
        const Icon = node.Icon;
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(node.x / 800) * 100}%`,
              top: `${(node.y / 360) * 100}%`,
              animationDelay: node.delay,
            }}
          >
            <div
              className="nimbus-endpoint flex flex-col items-center gap-1.5"
              style={{ animationDelay: node.delay }}
            >
              <div className="relative">
                <div className="absolute -inset-1 rounded-[14px] bg-sky-400/20 blur-[6px]" aria-hidden />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-sky-300/35 bg-[linear-gradient(160deg,rgba(14,40,78,0.98),rgba(8,24,52,0.98))] text-sky-200 shadow-[0_10px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                </div>
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  aria-hidden
                />
              </div>
              <span className="rounded-md bg-[#071a35]/75 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-slate-200 backdrop-blur-sm">
                {node.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
