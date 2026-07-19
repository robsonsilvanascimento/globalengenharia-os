import { Component, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';

class OsDetailErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#dc2626' }}>
          <h2>Erro ao carregar a OS</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { LoginPage } from '../features/auth/LoginPage';
import { EsqueciSenhaPage } from '../features/auth/EsqueciSenhaPage';
import { RedefinirSenhaPage } from '../features/auth/RedefinirSenhaPage';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { OrdensServicoListPage } from '../features/ordens-servico/OrdensServicoListPage';
import { OrdemServicoCreatePage } from '../features/ordens-servico/OrdemServicoCreatePage';
import { OrdemServicoDetailPage } from '../features/ordens-servico/OrdemServicoDetailPage';
import { UsuariosPage } from '../features/usuarios/UsuariosPage';
import { CategoriasServicoPage } from '../features/categorias-servico/CategoriasServicoPage';
import { FaqPage } from '../features/faq/FaqPage';
import { AtendimentoHumanoPage } from '../features/atendimento-humano/AtendimentoHumanoPage';
import { ClientesPage } from '../features/clientes/ClientesPage';
import { ClienteDetailPage } from '../features/clientes/ClienteDetailPage';
import { LaudosPage } from '../features/laudos/LaudosPage';
import { ContasReceberPage } from '../features/financeiro-recorrente/ContasReceberPage';
import { ContratosPage } from '../features/financeiro-recorrente/ContratosPage';
import { RotaPage } from '../features/rastreio/RotaPage';
import AnalyticsDashboardPage from '../features/analytics/pages/AnalyticsDashboardPage';
import { lazy, Suspense } from 'react';
import SlaConfigPage from '../features/sla/pages/SlaConfigPage';

const NpsDashboardPage = lazy(() => import('../features/nps/pages/NpsDashboardPage'));
const FinanceiroDashboardPage = lazy(() => import('../features/financeiro/pages/FinanceiroDashboardPage'));
const ManutencaoPage = lazy(() => import('../features/manutencao/pages/ManutencaoPage'));
const EstoquePage = lazy(() => import('../features/estoque/pages/EstoquePage'));
const ApiKeysPage = lazy(() => import('../features/api-keys/pages/ApiKeysPage'));
import RelatorioConfigPage from '../features/relatorio/pages/RelatorioConfigPage';
import { NpsRespostaPage } from '../features/nps/pages/NpsRespostaPage';
import { PortalClientePage } from '../features/portal/pages/PortalClientePage';

function AcessoNegadoPage() {
  return <div>Você não tem permissão para acessar esta página.</div>;
}

/**
 * Central route configuration.
 * Wrapped by <BrowserRouter> in main.tsx.
 * Authenticated routes are nested under a layout route that renders
 * <AppShell> (Header + Sidebar + <Outlet />) inside <ProtectedRoute>.
 * New feature pages (ordens-servico, usuarios, categorias-servico) are
 * added as children here as their features are implemented.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route path="/acesso-negado" element={<AcessoNegadoPage />} />
      <Route path="/nps/:token" element={<NpsRespostaPage />} />
      <Route path="/portal/:token" element={<PortalClientePage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<OrdensServicoListPage />} />

        <Route
          path="/ordens-servico/novo"
          element={
            <ProtectedRoute allowedRoles={['atendente', 'admin']}>
              <OrdemServicoCreatePage />
            </ProtectedRoute>
          }
        />

        <Route path="/ordens-servico/:id" element={
          <OsDetailErrorBoundary>
            <OrdemServicoDetailPage />
          </OsDetailErrorBoundary>
        } />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/categorias-servico"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CategoriasServicoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/faq"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <FaqPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atendimento-humano"
          element={
            <ProtectedRoute allowedRoles={['atendente', 'admin']}>
              <AtendimentoHumanoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/laudos"
          element={
            <ProtectedRoute allowedRoles={['admin', 'tecnico']}>
              <LaudosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contas-receber"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ContasReceberPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contratos"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ContratosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rota"
          element={
            <ProtectedRoute allowedRoles={['admin', 'tecnico']}>
              <RotaPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <ProtectedRoute allowedRoles={['atendente', 'admin']}>
              <ClientesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes/:id"
          element={
            <ProtectedRoute allowedRoles={['atendente', 'admin']}>
              <ClienteDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AnalyticsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/nps"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<p>Carregando...</p>}>
                <NpsDashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/config/sla"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SlaConfigPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/config/relatorio"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RelatorioConfigPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/financeiro"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<p>Carregando...</p>}>
                <FinanceiroDashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/estoque"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<p>Carregando...</p>}>
                <EstoquePage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/manutencao"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<p>Carregando...</p>}>
                <ManutencaoPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/configuracoes/api-keys"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<p>Carregando...</p>}>
                <ApiKeysPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
