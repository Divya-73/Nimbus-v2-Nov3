import { useState } from 'react';

export const TIME_PRESETS = [
  { id: '1h', label: '1 hour', seconds: 3600 },
  { id: '6h', label: '6 hours', seconds: 21600 },
  { id: '24h', label: '24 hours', seconds: 86400 },
  { id: '7d', label: '7 days', seconds: 7 * 86400 },
];

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toLocalInput(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

export function rangeFromPreset(presetId) {
  const preset = TIME_PRESETS.find((item) => item.id === presetId);
  if (!preset?.seconds) return null;
  const to = Math.floor(Date.now() / 1000);
  return { from: to - preset.seconds, to };
}

export function formatPointTime(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString();
}

export function axisTimeLabel(ts, fromMs, toMs) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  const span = Number(toMs) - Number(fromMs);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (span > 20 * 3600 * 1000) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}\n${hm}`;
  }
  return hm;
}

export function hexToRgba(hex, alpha) {
  const n = String(hex || '').replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useTimeRange(defaultPreset = '1h') {
  const initial = rangeFromPreset(defaultPreset) || rangeFromPreset('1h');
  const [preset, setPreset] = useState(defaultPreset);
  const [range, setRange] = useState(initial);
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(initial.from * 1000));
  const [customTo, setCustomTo] = useState(() => toLocalInput(initial.to * 1000));
  const [rangeError, setRangeError] = useState('');

  const applyPreset = (id) => {
    const next = rangeFromPreset(id);
    if (!next) return;
    setPreset(id);
    setRangeError('');
    setCustomFrom(toLocalInput(next.from * 1000));
    setCustomTo(toLocalInput(next.to * 1000));
    setRange(next);
  };

  const applyRange = () => {
    const from = fromLocalInput(customFrom);
    const to = fromLocalInput(customTo);
    if (from == null || to == null) {
      setRangeError('Choose a valid from and to time');
      return;
    }
    if (from >= to) {
      setRangeError('From must be earlier than To');
      return;
    }
    if (to - from > 30 * 86400) {
      setRangeError('Range cannot exceed 30 days');
      return;
    }
    setRangeError('');
    setPreset('');
    setRange({ from, to });
  };

  const presetLabel = TIME_PRESETS.find((item) => item.id === preset)?.label || 'selected range';

  return {
    preset,
    range,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    rangeError,
    applyPreset,
    applyRange,
    presetLabel,
  };
}
