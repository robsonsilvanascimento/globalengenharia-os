import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { AlertasSino } from '../../features/alertas/components/AlertasSino';
import './Header.css';

const PAPEL_LABEL: Record<string, string> = {
  atendente: 'Atendente',
  tecnico: 'Técnico',
  admin: 'Admin',
};

interface HeaderProps {
  onMenuToggle: () => void;
}

/** Top bar showing the logged-in user's name/role and a logout action. */
export function Header({ onMenuToggle }: HeaderProps) {
  const { usuario, papel, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="app-header-menu-toggle"
          onClick={onMenuToggle}
          aria-label="Abrir menu de navegação"
        >
          <Menu size={22} />
        </button>
        <Link to="/" className="app-header-logo-link" aria-label="Ir para a página inicial">
          <img
            src="/brand/logo.png"
            alt="Global Engenharia"
            className="app-header-logo"
          />
        </Link>
      </div>

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
