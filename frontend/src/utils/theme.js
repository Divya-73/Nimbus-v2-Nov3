const THEME_KEY = 'theme';
export const THEMES = ['light', 'grey', 'dark'];

function syncThemeClass(el, theme) {
  if (!el) return;
  el.classList.remove('theme-light', 'theme-dark', 'theme-grey', 'dark');
  el.classList.add(`theme-${theme}`);
  if (theme === 'dark' || theme === 'grey') el.classList.add('dark');
}

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY) || 'light';
  return THEMES.includes(stored) ? stored : 'light';
}

export function applyTheme(theme = 'light') {
  const next = THEMES.includes(theme) ? theme : 'light';
  syncThemeClass(document.documentElement, next);
  syncThemeClass(document.body, next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}

/** Persist + apply (alias used by dashboard shell). */
export function setStoredTheme(theme) {
  return applyTheme(theme);
}

export function getNextTheme(current = getStoredTheme()) {
  const idx = THEMES.indexOf(current);
  return THEMES[(idx + 1) % THEMES.length];
}
