/**
 * Vanilla (framework-agnostic) tema store, no mesmo espirito do authStore:
 * um Set de listeners + useSyncExternalStore, sem precisar de Context/
 * Provider para algo tao pequeno quanto claro/escuro.
 *
 * O tema escolhido e persistido e aplicado como atributo `data-theme` na
 * raiz do documento — e esse atributo, nao a preferencia do SO, que os
 * overrides escuros em global.css leem com maior especificidade. Quando o
 * usuario nunca escolheu nada, `theme` fica `null` ("segue o sistema") e o
 * app usa a media query prefers-color-scheme como padrao.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tema';

type Listener = () => void;

function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme | null): void {
  const root = document.documentElement;
  if (theme) {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

let theme: Theme | null = readStoredTheme();
applyTheme(theme);

const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setTheme(next: Theme | null): void {
  theme = next;
  applyTheme(next);
  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors (e.g. private browsing mode)
  }
  emit();
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function toggleTheme(): void {
  const efetivo = theme ?? (systemPrefersDark() ? 'dark' : 'light');
  setTheme(efetivo === 'dark' ? 'light' : 'dark');
}

export const themeStore = {
  getState(): Theme | null {
    return theme;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setTheme,
  toggleTheme,
  systemPrefersDark,
};
