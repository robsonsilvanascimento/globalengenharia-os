import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useClienteDetalheQuery } from './useClienteDetalheQuery';
import { useClienteResumoQuery } from './useClienteResumoQuery';
import type { ClienteResumoOrdemServico } from '../../types/api';
import './ClienteDetailPage.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  return currencyFormatter.format(valor);
}

function formatDataAbertura(criadoEm: string): string {
  const data = new Date(criadoEm);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
}

function truncate(texto: string, tamanho = 60): string {
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto;
}

/** Cliente cadastral data, OS totals and OS history for a single cliente. */
export function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const clienteQuery = useClienteDetalheQuery(id);
  const resumoQuery = useClienteResumoQuery(id);

  if (!id) {
    return <ErrorState message="Cliente inválido." />;
  }

  if (clienteQuery.isLoading) {
    return <LoadingState message="Carregando cliente..." />;
  }

  if (clienteQuery.isError || !clienteQuery.data) {
    return <ErrorState message="Não foi possível carregar o cliente." onRetry={() => clienteQuery.refetch()} />;
  }

  const cliente = clienteQuery.data;

  const columns: TableColumn<ClienteResumoOrdemServico>[] = [
    { key: 'numero', header: 'Número' },
    { key: 'categoria_nome', header: 'Categoria' },
    { key: 'descricao_problema', header: 'Descrição', render: (os) => truncate(os.descricao_problema) },
    { key: 'status', header: 'Status', render: (os) => <Badge variant="status" value={os.status} /> },
    { key: 'valor_cobrado', header: 'Valor cobrado', render: (os) => formatValor(os.valor_cobrado) },
    { key: 'criado_em', header: 'Data', render: (os) => formatDataAbertura(os.criado_em) },
  ];

  return (
    <div className="cliente-detail-page">
      <div className="cliente-detail-header">
        <button type="button" className="cliente-detail-back" onClick={() => navigate('/clientes')}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 className="cliente-detail-title">{cliente.nome}</h1>
      </div>

      <section className="cliente-detail-card">
        <dl className="cliente-detail-grid">
          <div className="cliente-detail-field">
            <dt>Telefone</dt>
            <dd>{cliente.telefone_whatsapp}</dd>
          </div>
          <div className="cliente-detail-field">
            <dt>E-mail</dt>
            <dd>{cliente.email ?? '—'}</dd>
          </div>
          <div className="cliente-detail-field">
            <dt>Documento</dt>
            <dd>{cliente.documento ?? '—'}</dd>
          </div>
          <div className="cliente-detail-field">
            <dt>Cliente desde</dt>
            <dd>{formatDataAbertura(cliente.criado_em)}</dd>
          </div>
        </dl>
      </section>

      {resumoQuery.isLoading ? (
        <LoadingState message="Carregando resumo..." />
      ) : resumoQuery.isError || !resumoQuery.data ? (
        <ErrorState message="Não foi possível carregar o resumo do cliente." onRetry={() => resumoQuery.refetch()} />
      ) : (
        <>
          <section className="cliente-detail-summary">
            <div className="cliente-detail-summary-card">
              <span className="cliente-detail-summary-label">Total de OS</span>
              <span className="cliente-detail-summary-value">{resumoQuery.data.total_ordens_servico}</span>
            </div>
            <div className="cliente-detail-summary-card">
              <span className="cliente-detail-summary-label">Total cobrado</span>
              <span className="cliente-detail-summary-value">
                {currencyFormatter.format(resumoQuery.data.total_valor_cobrado)}
              </span>
            </div>
          </section>

          <section className="cliente-detail-card">
            <h2 className="cliente-detail-section-title">Histórico de ordens de serviço</h2>
            <Table
              columns={columns}
              rows={resumoQuery.data.ordens_servico}
              rowKey={(os) => os.id}
              onRowClick={(os) => navigate(`/ordens-servico/${os.id}`)}
              emptyMessage="Nenhuma ordem de serviço registrada para este cliente."
            />
          </section>
        </>
      )}
    </div>
  );
}
