import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { AlertasSino } from '../../features/alertas/components/AlertasSino';
import './Header.css';

const PAPEL_LABEL: Record<string, string> = {
  atendente: 'Atendente',
  tecnico: 'Técnico',
  admin: 'Admin',
};

/** Top bar showing the logged-in user's name/role and a logout action. */
export function Header() {
  const { usuario, papel, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="app-header">
      <Link to="/" className="app-header-logo-link" aria-label="Ir para a página inicial">
        <img
          src="/brand/logo.png"
          alt="Global Engenharia"
          className="app-header-logo"
        />
      </Link>

      <div className="app-header-user">
        <AlertasSino />
        <span className="app-header-user-name">{usuario?.nome}</span>
        {papel && <span className="app-header-role-badge">{PAPEL_LABEL[papel] ?? papel}</span>}
        <button type="button" className="app-header-logout" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}
