import { httpClient, setStoredTokens, setUnauthorizedHandler } from '../../lib/api/httpClient';
import type { AuthLoginResponse, AuthRefreshResponse, Usuario } from '../../types/api';

/**
 * Vanilla (framework-agnostic) auth store.
 *
 * Why not a Context or zustand:
 * - `httpClient` needs to trigger a logout from outside the React tree
 *   (on a failed refresh), so the store must be reachable without a
 *   Provider/hook.
 * - React 18's `useSyncExternalStore` lets `useAuth` subscribe to this
 *   plain store with no extra dependency, so pulling in zustand just for
 *   this would be unnecessary weight for a single, small store.
 */

const USUARIO_STORAGE_KEY = 'usuario';
const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

export interface AuthState {
  usuario: Usuario | null;
  accessToken: string | null;
  refreshToken: string | null;
}

type Listener = () => void;

function readStoredUsuario(): Usuario | null {
  try {
    const raw = localStorage.getItem(USUARIO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistUsuario(usuario: Usuario | null): void {
  try {
    if (usuario) {
      localStorage.setItem(USUARIO_STORAGE_KEY, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(USUARIO_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors (e.g. private browsing mode)
  }
}

let state: AuthState = {
  usuario: readStoredUsuario(),
  accessToken: readStoredValue(ACCESS_TOKEN_STORAGE_KEY),
  refreshToken: readStoredValue(REFRESH_TOKEN_STORAGE_KEY),
};

const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(next: AuthState): void {
  state = next;
  persistUsuario(next.usuario);
  setStoredTokens(
    next.accessToken && next.refreshToken
      ? { accessToken: next.accessToken, refreshToken: next.refreshToken }
      : null,
  );
  emit();
}

async function login(email: string, senha: string): Promise<Usuario> {
  const response = await httpClient.post<AuthLoginResponse>('/auth/login', { email, senha });

  setState({
    usuario: response.usuario,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  });

  return response.usuario;
}

function logout(): void {
  setState({ usuario: null, accessToken: null, refreshToken: null });
}

async function refreshAccessToken(): Promise<void> {
  if (!state.refreshToken) {
    throw new Error('Nenhum refresh token disponível.');
  }

  const response = await httpClient.post<AuthRefreshResponse>('/auth/refresh', {
    refreshToken: state.refreshToken,
  });

  setState({
    ...state,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  });
}

// Wired once: when httpClient exhausts a refresh attempt on a 401, it calls
// this handler, which just clears the store (ProtectedRoute takes care of
// redirecting to /login on the next render).
setUnauthorizedHandler(() => {
  logout();
});

export const authStore = {
  getState(): AuthState {
    return state;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  login,
  logout,
  refreshAccessToken,
};
