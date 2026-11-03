export function regionStatusPillClass(status) {
  const key = String(status ?? '').toLowerCase();
  if (key === 'up') return 'dl-pill dl-pill--up';
  if (key === 'down') return 'dl-pill dl-pill--down';
  if (key === 'partial') return 'dl-pill dl-pill--partial';
  if (key === 'unknown') return 'dl-pill dl-pill--na';
  return 'dl-pill';
}

export function deviceStatusPillClass(status) {
  const key = String(status ?? '').toLowerCase();
  if (key === 'up') return 'dl-pill dl-pill--up';
  if (key === 'down') return 'dl-pill dl-pill--down';
  if (key === 'onboard') return 'dl-pill dl-pill--onboard';
  return 'dl-pill';
}

export function formatSdwan(sdwan) {
  if (sdwan && typeof sdwan === 'object') return sdwan.status || '—';
  return sdwan || '—';
}

export function sdwanPillClass(sdwan) {
  const key = String(sdwan?.status ?? sdwan ?? '').toUpperCase();
  if (key === 'UP') return 'dl-pill dl-pill--up';
  if (key === 'DOWN') return 'dl-pill dl-pill--down';
  return 'dl-pill';
}
