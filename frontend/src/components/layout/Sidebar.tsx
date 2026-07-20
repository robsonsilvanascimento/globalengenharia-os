import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { useMagneticHover } from '../ui/useMagneticHover';
import './Sidebar.css';

interface NavItem {
  label: string;
  to: string;
}

/** Item de menu que flutua sutilmente em direção ao cursor antes do clique. */
function MagneticNavLink({
  to,
  end,
  label,
  onClick,
}: {
  to: string;
  end: boolean;
  label: string;
  onClick: () => void;
}) {
  const ref = useMagneticHover<HTMLAnchorElement>();
  return (
    <NavLink
      ref={ref}
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => (isActive ? 'app-sidebar-link app-sidebar-link-active' : 'app-sidebar-link')}
    >
      {label}
    </NavLink>
  );
}

const COMMON_ITEMS: NavItem[] = [{ label: 'Ordens de Serviço', to: '/' }];

// Disponivel para a equipe tecnica (admin e tecnico).
const LAUDO_ITEMS: NavItem[] = [{ label: 'Laudos Técnicos', to: '/laudos' }];
const ROTA_ITEMS: NavItem[] = [{ label: 'Minha Rota', to: '/rota' }];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Usuários', to: '/usuarios' },
  { label: 'Categorias de Serviço', to: '/categorias-servico' },
  { label: 'Base de Conhecimento (FAQ)', to: '/faq' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'NPS', to: '/nps' },
  { label: 'Config SLA', to: '/config/sla' },
  { label: 'Relatório Gerencial', to: '/config/relatorio' },
  { label: 'Financeiro', to: '/financeiro' },
  { label: 'Contas a Receber', to: '/contas-receber' },
  { label: 'Contratos', to: '/contratos' },
  { label: 'Estoque', to: '/estoque' },
  { label: 'Manutenção', to: '/manutencao' },
  { label: 'Chaves de API', to: '/configuracoes/api-keys' },
];

const ATENDENTE_ITEMS: NavItem[] = [
  { label: 'Clientes', to: '/clientes' },
  { label: 'Atendimento Humano', to: '/atendimento-humano' },
];

interface SidebarProps {
  /** Em telas estreitas o menu vira um drawer off-canvas controlado por este flag. */
  open: boolean;
  onClose: () => void;
}

/** Left-hand navigation menu, filtered according to the current user's role. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const { papel } = useAuth();
  const items = [
    ...COMMON_ITEMS,
    ...(papel === 'admin' || papel === 'tecnico' ? LAUDO_ITEMS : []),
    ...(papel === 'admin' || papel === 'tecnico' ? ROTA_ITEMS : []),
    ...(papel === 'atendente' || papel === 'admin' ? ATENDENTE_ITEMS : []),
    ...(papel === 'admin' ? ADMIN_ITEMS : []),
  ];

  return (
    <>
      {open && <div className="app-sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <nav className={open ? 'app-sidebar app-sidebar-open' : 'app-sidebar'}>
        <button type="button" className="app-sidebar-close" onClick={onClose} aria-label="Fechar menu">
          <X size={20} />
        </button>
        <ul className="app-sidebar-list">
          {items.map((item) => (
            <li key={item.to}>
              <MagneticNavLink to={item.to} end={item.to === '/'} label={item.label} onClick={onClose} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
