import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import type { PapelUsuario } from '../types/api';

export interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: PapelUsuario[];
}

/**
 * Wraps a route element, requiring authentication (and, optionally, that
 * the current user's `papel` is in `allowedRoles`).
 * - Not authenticated -> redirects to /login (keeping the original
 *   location so LoginPage can send the user back after a successful login).
 * - Authenticated but role not allowed -> redirects to /acesso-negado.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, papel } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && (!papel || !allowedRoles.includes(papel))) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
