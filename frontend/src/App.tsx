import { useEffect, useState } from 'react';
import { ThemePicker } from './components/ThemePicker';
import { NearbyStockPage } from './pages/NearbyStockPage';
import { applyTheme, loadThemePreference, saveThemePreference, type ThemePreference } from './theme';

export function App() {
  const [theme, setTheme] = useState<ThemePreference>(loadThemePreference);

  useEffect(() => {
    applyTheme(theme);
    saveThemePreference(theme);
  }, [theme]);

  return (
    <>
      <header className="app-header">
        <div className="app-header__brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          Binhopper
        </div>
        <ThemePicker value={theme} onChange={setTheme} />
      </header>
      {/* Sample album from backend/scripts/seed_sample.py. Routing comes with the next screens. */}
      <NearbyStockPage albumId={1} albumTitle="Rumours" artistName="Fleetwood Mac" />
    </>
  );
}
