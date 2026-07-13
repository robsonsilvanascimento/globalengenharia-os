import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import type { SelectOption } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { SLABadge } from '../../components/shared/SLABadge';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient } from '../../lib/api/httpClient';
import { useAuth } from '../auth/useAuth';
import { useOrdensServicoQuery } from './useOrdensServicoQuery';
import { StatusSummaryCards } from './StatusSummaryCards';
import type { CategoriaServico, OrdemServico, PrioridadeOrdemServico, StatusOrdemServico, Usuario } from '../../types/api';
import './OrdensServicoListPage.css';

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'triagem', label: 'Triagem' },
  { value: 'atribuida', label: 'Atribuída' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_peca', label: 'Aguardando peça' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PRIORIDADE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todas' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const PRIORIDADE_LABELS: Record<PrioridadeOrdemServico, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

function formatDataAbertura(criadoEm: string): string {
  const data = new Date(criadoEm);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  return currencyFormatter.format(valor);
}

/**
 * Dashboard/list page for ordens de serviço, with status/prioridade/categoria/
 * técnico filters. Prioridade and categoria are not supported as server-side
 * query params by the current API contract, so they are applied client-side
 * on top of the fetched page.
 */
export function OrdensServicoListPage() {
  const { papel, usuario } = useAuth();
  const navigate = useNavigate();
  const isTecnico = papel === 'tecnico';

  const [status, setStatus] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [page, setPage] = useState(1);

  const tecnicoFiltroAtivo = isTecnico ? usuario?.id : tecnicoId || undefined;

  const ordensQuery = useOrdensServicoQuery({
    status: (status || undefined) as StatusOrdemServico | undefined,
    tecnico_id: tecnicoFiltroAtivo,
    page,
  });

  const categoriasQuery = useQuery({
    queryKey: ['categorias-servico'],
    queryFn: () => httpClient.get<CategoriaServico[]>('/categorias-servico'),
  });

  const usuariosQuery = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => httpClient.get<Usuario[]>('/usuarios'),
  });

  const categoriaOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Todas' },
      ...(categoriasQuery.data ?? []).map((categoria) => ({ value: categoria.id, label: categoria.nome })),
    ],
    [categoriasQuery.data],
  );

  const tecnicoOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Todos' },
      ...(usuariosQuery.data ?? [])
        .filter((candidate) => candidate.papel === 'tecnico')
        .map((tecnico) => ({ value: tecnico.id, label: tecnico.nome })),
    ],
    [usuariosQuery.data],
  );

  function handleFilterChange(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const rows = useMemo(() => {
    const data = ordensQuery.data?.data ?? [];
    return data.filter((os) => {
      if (prioridade && os.prioridade !== prioridade) {
        return false;
      }
      if (categoriaId && os.categoria_servico_id !== categoriaId) {
        return false;
      }
      return true;
    });
  }, [ordensQuery.data, prioridade, categoriaId]);

  const totalPages = ordensQuery.data ? Math.max(1, Math.ceil(ordensQuery.data.total / ordensQuery.data.page_size)) : 1;

  const columns: TableColumn<OrdemServico>[] = [
    { key: 'numero', header: 'Número', render: (os) => <><span>{os.numero}</span><SLABadge slaVencido={os.sla_vencido ?? false} /></> },
    { key: 'cliente_nome', header: 'Cliente' },
    { key: 'status', header: 'Status', render: (os) => <Badge variant="status" value={os.status} /> },
    { key: 'prioridade', header: 'Prioridade', render: (os) => PRIORIDADE_LABELS[os.prioridade] },
    { key: 'tecnico_nome', header: 'Técnico', render: (os) => os.tecnico_nome ?? '-' },
    { key: 'valor_cobrado', header: 'Valor', render: (os) => formatValor(os.valor_cobrado) },
    { key: 'criado_em', header: 'Data de abertura', render: (os) => formatDataAbertura(os.criado_em) },
  ];

  return (
    <div className="ordens-servico-list-page">
      <div className="ordens-servico-list-header">
        <h1>Ordens de Serviço</h1>
        <Link to="/ordens-servico/novo" className="ordens-servico-list-new-button">
          Nova OS
        </Link>
      </div>

      <StatusSummaryCards statusAtivo={status} onSelecionarStatus={handleFilterChange(setStatus)} />

      <div className="ordens-servico-list-filters">
        <label className="ordens-servico-list-filter">
          <span>Status</span>
          <Select options={STATUS_OPTIONS} value={status} onChange={handleFilterChange(setStatus)} />
        </label>

        <label className="ordens-servico-list-filter">
          <span>Prioridade</span>
          <Select options={PRIORIDADE_OPTIONS} value={prioridade} onChange={handleFilterChange(setPrioridade)} />
        </label>

        <label className="ordens-servico-list-filter">
          <span>Categoria</span>
          <Select options={categoriaOptions} value={categoriaId} onChange={handleFilterChange(setCategoriaId)} />
        </label>

        {!isTecnico && (
          <label className="ordens-servico-list-filter">
            <span>Técnico</span>
            <Select options={tecnicoOptions} value={tecnicoId} onChange={handleFilterChange(setTecnicoId)} />
          </label>
        )}
      </div>

      {ordensQuery.isLoading ? (
        <LoadingState message="Carregando ordens de serviço..." />
      ) : ordensQuery.isError ? (
        <ErrorState
          message="Não foi possível carregar as ordens de serviço."
          onRetry={() => ordensQuery.refetch()}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(os) => os.id}
            onRowClick={(os) => navigate(`/ordens-servico/${os.id}`)}
            emptyMessage="Nenhuma ordem de serviço encontrada."
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
