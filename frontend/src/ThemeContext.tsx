import { createContext, useContext } from 'react';
import type { ThemePreference } from './theme';

/** The app's appearance choice, shared by the header picker and You › Settings. */
export const ThemeContext = createContext<{ theme: ThemePreference; setTheme: (t: ThemePreference) => void }>({
  theme: 'system', setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);
