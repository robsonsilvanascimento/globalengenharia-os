import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import type {
  CategoriaServico,
  DisponibilidadeOrdemServico,
  HistoricoStatusOS,
  MidiaOrdemServico,
  OrdemServico,
  StatusOrdemServico,
  Usuario,
} from '../../types/api';
import { useAuth } from '../auth/useAuth';
import { Badge } from '../../components/ui/Badge';
import { SLABadge } from '../../components/shared/SLABadge';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Timeline } from '../../components/ordens-servico/Timeline';
import { EstimativaCustoSection } from '../estimativa-custo/EstimativaCustoSection';
import { RastreabilidadeSection } from './RastreabilidadeSection';
import { AuditLogSection } from './AuditLogSection';
import { PendenciasSection } from './components/PendenciasSection';
import { ChecklistSection } from './components/ChecklistSection';
import { HistoricoClienteSection } from './components/HistoricoClienteSection';
import { FotosEvidenciaSection } from './components/FotosEvidenciaSection';
import { PagamentosSection } from '../financeiro/components/PagamentosSection';
import { ConsumoPecasSection } from '../estoque/components/ConsumoPecasSection';
import './RastreabilidadeSection.css';
import { getValidTransitions, isStatusTerminal, PRIORIDADE_LABELS, STATUS_LABELS } from './statusTransitions';
import './OrdemServicoDetailPage.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function formatDataAgendada(iso: string | null | undefined): string {
  if (!iso) {
    return 'Não agendada';
  }
  return new Date(iso).toLocaleString('pt-BR');
}

/** Converts a `datetime-local` input value (local time, no timezone) to an ISO string. */
function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

function formatValorCobrado(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return 'Não informado';
  }
  return currencyFormatter.format(valor);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface OrdemServicoVideoItemProps {
  ordemServicoId: string;
  midia: MidiaOrdemServico;
  podeApagar: boolean;
  onApagar: (midiaId: string) => void;
  isApagando: boolean;
}

function OrdemServicoVideoItem({ ordemServicoId, midia, podeApagar, onApagar, isApagando }: OrdemServicoVideoItemProps) {
  const arquivoQuery = useQuery({
    queryKey: ['ordens-servico', ordemServicoId, 'midias', midia.id, 'arquivo'],
    queryFn: () => httpClient.getBlob(`/ordens-servico/${ordemServicoId}/midias/${midia.id}/arquivo`),
  });

  const videoUrl = useMemo(() => {
    if (!arquivoQuery.data) {
      return null;
    }
    return URL.createObjectURL(arquivoQuery.data);
  }, [arquivoQuery.data]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="os-detail-video-item">
      {arquivoQuery.isLoading && <LoadingState message="Carregando vídeo..." />}
      {arquivoQuery.isError && (
        <ErrorState message={errorMessage(arquivoQuery.error)} onRetry={() => arquivoQuery.refetch()} />
      )}
      {videoUrl && <video controls className="os-detail-video-player" src={videoUrl} />}
      <div className="os-detail-video-meta">
        <span>{formatBytes(midia.tamanho_bytes)}</span>
        <span>Recebido em {formatDateTime(midia.criado_em)}</span>
        {podeApagar && (
          <button
            type="button"
            className="os-detail-button os-detail-button-danger"
            onClick={() => onApagar(midia.id)}
            disabled={isApagando}
          >
            {isApagando ? 'Apagando...' : 'Apagar'}
          </button>
        )}
      </div>
    </div>
  );
}

export function OrdemServicoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { papel } = useAuth();
  const queryClient = useQueryClient();

  const podeGerenciar = papel === 'atendente' || papel === 'admin';
  const podeVerMidias = papel === 'admin' || papel === 'tecnico';

  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState<string>('');
  const [selectedAjudanteId, setSelectedAjudanteId] = useState<string>('');
  const [dataAgendadaInput, setDataAgendadaInput] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isValorModalOpen, setIsValorModalOpen] = useState(false);
  const [valorCobradoInput, setValorCobradoInput] = useState<string>('');
  const [valorError, setValorError] = useState<string | null>(null);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

  const ordemQuery = useQuery({
    queryKey: ['ordens-servico', id],
    queryFn: () => httpClient.get<OrdemServico>(`/ordens-servico/${id}`),
    enabled: Boolean(id),
  });

  const historicoQuery = useQuery({
    queryKey: ['ordens-servico', id, 'historico'],
    queryFn: () => httpClient.get<HistoricoStatusOS[]>(`/ordens-servico/${id}/historico`),
    enabled: Boolean(id),
  });

  const usuariosQuery = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => httpClient.get<Usuario[]>('/usuarios'),
  });

  const categoriasQuery = useQuery({
    queryKey: ['categorias-servico'],
    queryFn: () => httpClient.get<CategoriaServico[]>('/categorias-servico'),
  });

  const midiasQuery = useQuery({
    queryKey: ['ordens-servico', id, 'midias'],
    queryFn: () => httpClient.get<MidiaOrdemServico[]>(`/ordens-servico/${id}/midias`),
    enabled: Boolean(id) && podeVerMidias,
  });

  const disponibilidadeQuery = useQuery({
    queryKey: ['ordens-servico', id, 'disponibilidade'],
    queryFn: () => httpClient.get<DisponibilidadeOrdemServico>(`/ordens-servico/${id}/disponibilidade`),
    enabled: Boolean(id) && isAssignModalOpen,
  });

  const statusMutation = useMutation({
    mutationFn: (status: StatusOrdemServico) =>
      httpClient.patch<OrdemServico>(`/ordens-servico/${id}/status`, { status }),
    onSuccess: () => {
      setSelectedStatus('');
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', id] });
    },
    onError: (err) => setStatusError(errorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: ({
      tecnicoId,
      ajudanteId,
      dataAgendada,
    }: {
      tecnicoId: string;
      ajudanteId: string;
      dataAgendada: string;
    }) =>
      httpClient.patch<OrdemServico>(`/ordens-servico/${id}/atribuir`, {
        tecnico_id: tecnicoId,
        ajudante_id: ajudanteId || undefined,
        data_agendada: dataAgendada ? datetimeLocalToIso(dataAgendada) : undefined,
      }),
    onSuccess: () => {
      setIsAssignModalOpen(false);
      setSelectedTecnicoId('');
      setSelectedAjudanteId('');
      setDataAgendadaInput('');
      setAssignError(null);
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', id] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setAssignError('Técnico ou ajudante não está disponível nesse horário, escolha outro.');
        return;
      }
      setAssignError(errorMessage(err));
    },
  });

  const valorMutation = useMutation({
    mutationFn: (valorCobrado: number) =>
      httpClient.patch<OrdemServico>(`/ordens-servico/${id}/valor`, { valor_cobrado: valorCobrado }),
    onSuccess: () => {
      setIsValorModalOpen(false);
      setValorCobradoInput('');
      setValorError(null);
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', id] });
    },
    onError: (err) => setValorError(errorMessage(err)),
  });

  const deleteMidiaMutation = useMutation({
    mutationFn: (midiaId: string) => httpClient.delete(`/ordens-servico/${id}/midias/${midiaId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', id, 'midias'] });
    },
  });

  const tecnicos = useMemo(
    () => (usuariosQuery.data ?? []).filter((usuario) => usuario.papel === 'tecnico' && usuario.ativo),
    [usuariosQuery.data],
  );

  const ajudanteNome = useMemo(() => {
    if (!ordemQuery.data?.ajudante_id) {
      return 'Nenhum';
    }
    return (
      usuariosQuery.data?.find((usuario) => usuario.id === ordemQuery.data?.ajudante_id)?.nome ?? 'Nenhum'
    );
  }, [ordemQuery.data, usuariosQuery.data]);

  const tecnicosDisponiveis = useMemo(
    () => disponibilidadeQuery.data?.tecnicos_disponiveis ?? tecnicos.map((tecnico) => ({ id: tecnico.id, nome: tecnico.nome })),
    [disponibilidadeQuery.data, tecnicos],
  );

  const ajudantesDisponiveis = useMemo(
    () => disponibilidadeQuery.data?.ajudantes_disponiveis ?? [],
    [disponibilidadeQuery.data],
  );

  const categoriaNome = useMemo(() => {
    if (!ordemQuery.data) {
      return '';
    }
    return (
      categoriasQuery.data?.find((categoria) => categoria.id === ordemQuery.data?.categoria_servico_id)?.nome ??
      ordemQuery.data.categoria_servico_id
    );
  }, [categoriasQuery.data, ordemQuery.data]);

  if (!id) {
    return <ErrorState message="Ordem de serviço inválida." />;
  }

  if (ordemQuery.isLoading) {
    return <LoadingState message="Carregando ordem de serviço..." />;
  }

  if (ordemQuery.isError || !ordemQuery.data) {
    const errMsg = ordemQuery.error instanceof ApiError
      ? `Erro ${ordemQuery.error.status}: ${ordemQuery.error.message}`
      : ordemQuery.error instanceof Error
        ? ordemQuery.error.message
        : 'Erro ao carregar a ordem de serviço.';
    return <ErrorState message={errMsg} onRetry={() => ordemQuery.refetch()} />;
  }

  const ordem = ordemQuery.data;
  const transicoesValidas = getValidTransitions(ordem.status, papel);
  const podeCancelar = podeGerenciar && !isStatusTerminal(ordem.status);

  function handleConfirmarStatus() {
    if (!selectedStatus) {
      return;
    }
    statusMutation.mutate(selectedStatus as StatusOrdemServico);
  }

  function handleCancelarOs() {
    setStatusError(null);
    statusMutation.mutate('cancelada');
  }

  function handleConfirmarAtribuicao() {
    if (!selectedTecnicoId) {
      return;
    }
    assignMutation.mutate({
      tecnicoId: selectedTecnicoId,
      ajudanteId: selectedAjudanteId,
      dataAgendada: dataAgendadaInput,
    });
  }

  function handleAbrirValorModal() {
    setValorCobradoInput(ordem.valor_cobrado != null ? String(ordem.valor_cobrado) : '');
    setValorError(null);
    setIsValorModalOpen(true);
  }

  function handleApagarMidia(midiaId: string) {
    if (window.confirm('Tem certeza que deseja apagar este vídeo? Esta ação não pode ser desfeita.')) {
      deleteMidiaMutation.mutate(midiaId);
    }
  }

  async function handleRelatorioTecnico() {
    setGerandoRelatorio(true);
    try {
      const blob = await httpClient.getBlob(`/ordens-servico/${id}/relatorio-tecnico`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-tecnico-os-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerandoRelatorio(false);
    }
  }

  function handleConfirmarValor() {
    const valorNumerico = Number(valorCobradoInput.replace(',', '.'));
    if (!valorCobradoInput || Number.isNaN(valorNumerico) || valorNumerico < 0) {
      setValorError('Informe um valor numérico válido.');
      return;
    }
    valorMutation.mutate(valorNumerico);
  }

  return (
    <div className="os-detail-page">
      <div className="os-detail-header">
        <button type="button" className="os-detail-back" onClick={() => navigate('/')}>
          ← Voltar
        </button>
        <div className="os-detail-title-row">
          <h1 className="os-detail-title">{ordem.numero}</h1>
          <Badge variant="status" value={ordem.status} />
          <SLABadge slaVencido={ordem.sla_vencido ?? false} />
        </div>
      </div>

      <section className="os-detail-card">
        <dl className="os-detail-grid">
          <div className="os-detail-field">
            <dt>Cliente</dt>
            <dd>{ordem.cliente_nome}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Categoria</dt>
            <dd>{categoriaNome}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Prioridade</dt>
            <dd>{PRIORIDADE_LABELS[ordem.prioridade]}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Técnico atribuído</dt>
            <dd>{ordem.tecnico_nome ?? 'Não atribuído'}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Ajudante</dt>
            <dd>{ajudanteNome}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Endereço de atendimento</dt>
            <dd>{ordem.endereco_atendimento ?? '—'}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Data/hora agendada</dt>
            <dd>{formatDataAgendada(ordem.data_agendada)}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Valor cobrado</dt>
            <dd>
              {formatValorCobrado(ordem.valor_cobrado)}
              {papel === 'admin' && (
                <button
                  type="button"
                  className="os-detail-button os-detail-valor-edit"
                  onClick={handleAbrirValorModal}
                >
                  Editar
                </button>
              )}
            </dd>
          </div>
          <div className="os-detail-field">
            <dt>Criada em</dt>
            <dd>{formatDateTime(ordem.criado_em)}</dd>
          </div>
          <div className="os-detail-field">
            <dt>Atualizada em</dt>
            <dd>{formatDateTime(ordem.atualizado_em)}</dd>
          </div>
          <div className="os-detail-field os-detail-field-full">
            <dt>Descrição do problema</dt>
            <dd>{ordem.descricao_problema}</dd>
          </div>
        </dl>
      </section>

      <section className="os-detail-card os-detail-actions">
        <h2 className="os-detail-section-title">Ações</h2>

        {transicoesValidas.length > 0 ? (
          <div className="os-detail-status-change">
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder="Selecione o novo status"
              options={transicoesValidas.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
            />
            <button
              type="button"
              className="os-detail-button os-detail-button-primary"
              onClick={handleConfirmarStatus}
              disabled={!selectedStatus || statusMutation.isPending}
            >
              {statusMutation.isPending ? 'Atualizando...' : 'Confirmar status'}
            </button>
          </div>
        ) : (
          <p className="os-detail-no-transition">Nenhuma transição de status disponível.</p>
        )}
        {statusError && <p className="os-detail-error">{statusError}</p>}

        {podeGerenciar && (
          <div className="os-detail-manage-buttons">
            <button
              type="button"
              className="os-detail-button"
              onClick={() => setIsAssignModalOpen(true)}
            >
              Atribuir técnico
            </button>
            <button
              type="button"
              className="os-detail-button os-detail-button-danger"
              onClick={handleCancelarOs}
              disabled={!podeCancelar || statusMutation.isPending}
            >
              Cancelar OS
            </button>
          </div>
        )}

        {(papel === 'admin' || papel === 'tecnico') && (
          <div className="os-detail-manage-buttons">
            <button
              type="button"
              className="os-detail-button os-detail-button-outline"
              onClick={() => { void handleRelatorioTecnico(); }}
              disabled={gerandoRelatorio}
              title="Baixar Relatório Técnico PDF"
            >
              {gerandoRelatorio ? 'Gerando PDF...' : 'Relatório Técnico'}
            </button>
          </div>
        )}
      </section>

      <section className="os-detail-card">
        <h2 className="os-detail-section-title">Histórico</h2>
        {historicoQuery.isLoading && <LoadingState message="Carregando histórico..." />}
        {historicoQuery.isError && (
          <ErrorState message={errorMessage(historicoQuery.error)} onRetry={() => historicoQuery.refetch()} />
        )}
        {historicoQuery.data && <Timeline historico={historicoQuery.data} usuarios={usuariosQuery.data} />}
      </section>

      {podeVerMidias && (
        <section className="os-detail-card">
          <h2 className="os-detail-section-title">Vídeos</h2>
          {midiasQuery.isLoading && <LoadingState message="Carregando vídeos..." />}
          {midiasQuery.isError && (
            <ErrorState message={errorMessage(midiasQuery.error)} onRetry={() => midiasQuery.refetch()} />
          )}
          {midiasQuery.data && midiasQuery.data.length === 0 && (
            <p className="os-detail-no-transition">Nenhum vídeo recebido para esta ordem de serviço.</p>
          )}
          {midiasQuery.data && midiasQuery.data.length > 0 && (
            <div className="os-detail-video-list">
              {midiasQuery.data.map((midia) => (
                <OrdemServicoVideoItem
                  key={midia.id}
                  ordemServicoId={id}
                  midia={midia}
                  podeApagar={papel === 'admin'}
                  onApagar={handleApagarMidia}
                  isApagando={deleteMidiaMutation.isPending && deleteMidiaMutation.variables === midia.id}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <EstimativaCustoSection ordemServicoId={id} />

      <RastreabilidadeSection
        ordemServicoId={id}
        isAdmin={papel === 'admin'}
        isTecnico={papel === 'tecnico'}
      />

      {papel === 'admin' && <AuditLogSection ordemServicoId={id} />}

      <ChecklistSection osId={id} />

      <PendenciasSection osId={id} />

      <FotosEvidenciaSection osId={id} />

      <HistoricoClienteSection clienteId={ordem.cliente_id} />

      <ConsumoPecasSection osId={id} />

      <PagamentosSection osId={id} valorCobrado={ordem.valor_cobrado} />

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedTecnicoId('');
          setSelectedAjudanteId('');
          setDataAgendadaInput('');
          setAssignError(null);
        }}
        title="Atribuir técnico"
      >
        <div className="os-detail-assign-modal">
          {disponibilidadeQuery.isLoading && <LoadingState message="Carregando disponibilidade..." />}
          {disponibilidadeQuery.isError && (
            <ErrorState
              message={errorMessage(disponibilidadeQuery.error)}
              onRetry={() => disponibilidadeQuery.refetch()}
            />
          )}
          {disponibilidadeQuery.data?.sem_data_agendada && (
            <p className="os-detail-warning">
              Nenhuma data/hora definida ainda — mostrando todos os técnicos/ajudantes ativos, sem checagem de
              disponibilidade.
            </p>
          )}
          <FormField label="Técnico" htmlFor="tecnico-select">
            <Select
              value={selectedTecnicoId}
              onChange={setSelectedTecnicoId}
              placeholder="Selecione um técnico"
              options={tecnicosDisponiveis.map((tecnico) => ({ value: tecnico.id, label: tecnico.nome }))}
            />
          </FormField>
          <FormField label="Ajudante (opcional)" htmlFor="ajudante-select">
            <Select
              value={selectedAjudanteId}
              onChange={setSelectedAjudanteId}
              placeholder="Selecione um ajudante"
              options={ajudantesDisponiveis.map((ajudante) => ({ value: ajudante.id, label: ajudante.nome }))}
            />
          </FormField>
          <FormField label="Data/hora do atendimento (opcional)" htmlFor="data-agendada-input">
            <input
              id="data-agendada-input"
              type="datetime-local"
              value={dataAgendadaInput}
              onChange={(event) => setDataAgendadaInput(event.target.value)}
            />
          </FormField>
          {assignError && <p className="os-detail-error">{assignError}</p>}
          <button
            type="button"
            className="os-detail-button os-detail-button-primary"
            onClick={handleConfirmarAtribuicao}
            disabled={!selectedTecnicoId || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Atribuindo...' : 'Confirmar atribuição'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isValorModalOpen}
        onClose={() => {
          setIsValorModalOpen(false);
          setValorCobradoInput('');
          setValorError(null);
        }}
        title="Editar valor cobrado"
      >
        <div className="os-detail-assign-modal">
          <FormField label="Valor cobrado (R$)" htmlFor="valor-cobrado-input" error={valorError ?? undefined}>
            <input
              id="valor-cobrado-input"
              type="number"
              min="0"
              step="0.01"
              value={valorCobradoInput}
              onChange={(event) => setValorCobradoInput(event.target.value)}
            />
          </FormField>
          <button
            type="button"
            className="os-detail-button os-detail-button-primary"
            onClick={handleConfirmarValor}
            disabled={valorMutation.isPending}
          >
            {valorMutation.isPending ? 'Salvando...' : 'Salvar valor'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
