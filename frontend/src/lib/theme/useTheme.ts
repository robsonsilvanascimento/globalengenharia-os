import { useSyncExternalStore } from 'react';
import { themeStore, type Theme } from './themeStore';

export interface UseThemeResult {
  /** Tema explicitamente escolhido pelo usuario, ou null se estiver seguindo o SO. */
  theme: Theme | null;
  /** Tema efetivamente aplicado agora (resolve o "segue o sistema" para light/dark). */
  temaEfetivo: Theme;
  toggleTheme: () => void;
}

/** React hook exposing the theme store's state and actions. */
export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getState, themeStore.getState);
  const temaEfetivo: Theme = theme ?? (themeStore.systemPrefersDark() ? 'dark' : 'light');

  return { theme, temaEfetivo, toggleTheme: themeStore.toggleTheme };
}
