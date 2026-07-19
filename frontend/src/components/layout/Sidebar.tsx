import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import './Sidebar.css';

interface NavItem {
  label: string;
  to: string;
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

/** Left-hand navigation menu, filtered according to the current user's role. */
export function Sidebar() {
  const { papel } = useAuth();
  const items = [
    ...COMMON_ITEMS,
    ...(papel === 'admin' || papel === 'tecnico' ? LAUDO_ITEMS : []),
    ...(papel === 'admin' || papel === 'tecnico' ? ROTA_ITEMS : []),
    ...(papel === 'atendente' || papel === 'admin' ? ATENDENTE_ITEMS : []),
    ...(papel === 'admin' ? ADMIN_ITEMS : []),
  ];

  return (
    <nav className="app-sidebar">
      <ul className="app-sidebar-list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'app-sidebar-link app-sidebar-link-active' : 'app-sidebar-link'
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
