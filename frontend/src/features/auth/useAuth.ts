import { useCallback, useSyncExternalStore } from 'react';
import { authStore } from './authStore';
import type { PapelUsuario, Usuario } from '../../types/api';

export interface UseAuthResult {
  usuario: Usuario | null;
  papel: PapelUsuario | null;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => void;
}

/** React hook exposing the auth store's state and actions. */
export function useAuth(): UseAuthResult {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);

  const login = useCallback((email: string, senha: string) => authStore.login(email, senha), []);
  const logout = useCallback(() => authStore.logout(), []);

  return {
    usuario: state.usuario,
    papel: state.usuario?.papel ?? null,
    isAuthenticated: Boolean(state.usuario && state.accessToken),
    login,
    logout,
  };
}
