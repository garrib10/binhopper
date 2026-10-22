export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'binhopper.theme';

/** Which theme actually shows, given the user's choice and the device setting. */
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** "system" removes data-theme so the CSS media query decides. */
export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function loadThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage can be blocked (private mode); fall back to the default.
  }
  return 'system';
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Not fatal: the choice just won't persist.
  }
}
