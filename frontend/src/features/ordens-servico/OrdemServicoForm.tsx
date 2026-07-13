import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Select';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import { useAuth } from '../auth/useAuth';
import type { CategoriaServico, Cliente, OrdemServico, PrioridadeOrdemServico } from '../../types/api';
import './OrdemServicoForm.css';

export type OrdemServicoFormMode = 'criar' | 'editar';

export interface OrdemServicoFormProps {
  modo: OrdemServicoFormMode;
  ordemServicoId?: string;
}

interface FormState {
  clienteId: string;
  categoriaServicoId: string;
  descricaoProblema: string;
  enderecoAtendimento: string;
  prioridade: PrioridadeOrdemServico;
}

const ESTADO_INICIAL: FormState = {
  clienteId: '',
  categoriaServicoId: '',
  descricaoProblema: '',
  enderecoAtendimento: '',
  prioridade: 'normal',
};

const OPCOES_PRIORIDADE: { value: PrioridadeOrdemServico; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

/**
 * Reusable create/edit form for Ordens de Serviço.
 * - `modo: 'criar'` -> POST /ordens-servico, then navigates to the created OS detail page.
 * - `modo: 'editar'` -> loads the existing OS via GET /ordens-servico/{id} and saves via PATCH.
 * Status is intentionally not editable here; it is managed on the detail page.
 */
export function OrdemServicoForm({ modo, ordemServicoId }: OrdemServicoFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { papel } = useAuth();

  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: () => httpClient.get<Cliente[]>('/clientes'),
  });

  const categoriasQuery = useQuery({
    queryKey: ['categorias-servico'],
    queryFn: () => httpClient.get<CategoriaServico[]>('/categorias-servico'),
  });

  const ordemServicoQuery = useQuery({
    queryKey: ['ordens-servico', ordemServicoId],
    queryFn: () => httpClient.get<OrdemServico>(`/ordens-servico/${ordemServicoId}`),
    enabled: modo === 'editar' && Boolean(ordemServicoId),
  });

  useEffect(() => {
    if (modo === 'editar' && ordemServicoQuery.data) {
      const ordemServico = ordemServicoQuery.data;
      setForm({
        clienteId: ordemServico.cliente_id,
        categoriaServicoId: ordemServico.categoria_servico_id,
        descricaoProblema: ordemServico.descricao_problema,
        enderecoAtendimento: ordemServico.endereco_atendimento ?? '',
        prioridade: ordemServico.prioridade,
      });
    }
  }, [modo, ordemServicoQuery.data]);

  const categoriasAtivas = useMemo(
    () => (categoriasQuery.data ?? []).filter((categoria) => categoria.ativo),
    [categoriasQuery.data],
  );

  const criarMutation = useMutation({
    mutationFn: (payload: {
      cliente_id: string;
      categoria_servico_id: string;
      descricao_problema: string;
      endereco_atendimento?: string;
      prioridade: PrioridadeOrdemServico;
    }) => httpClient.post<OrdemServico>('/ordens-servico', payload),
    onSuccess: (ordemServico) => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      navigate(`/ordens-servico/${ordemServico.id}`, { replace: true });
    },
  });

  const editarMutation = useMutation({
    mutationFn: (payload: {
      cliente_id: string;
      categoria_servico_id: string;
      descricao_problema: string;
      endereco_atendimento?: string;
      prioridade: PrioridadeOrdemServico;
    }) => httpClient.patch<OrdemServico>(`/ordens-servico/${ordemServicoId}`, payload),
    onSuccess: (ordemServico) => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico', ordemServicoId] });
      navigate(`/ordens-servico/${ordemServico.id}`, { replace: true });
    },
  });

  const isSubmitting = criarMutation.isPending || editarMutation.isPending;

  const isFormValido =
    form.clienteId.trim() !== '' &&
    form.categoriaServicoId.trim() !== '' &&
    form.descricaoProblema.trim() !== '';

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(null);

    if (!isFormValido) {
      return;
    }

    const payload = {
      cliente_id: form.clienteId,
      categoria_servico_id: form.categoriaServicoId,
      descricao_problema: form.descricaoProblema.trim(),
      endereco_atendimento: form.enderecoAtendimento.trim() || undefined,
      prioridade: form.prioridade,
    };

    try {
      if (modo === 'criar') {
        await criarMutation.mutateAsync(payload);
      } else {
        await editarMutation.mutateAsync(payload);
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Não foi possível salvar a ordem de serviço. Tente novamente.',
      );
    }
  }

  if (papel && papel !== 'atendente' && papel !== 'admin') {
    return <ErrorState message="Você não tem permissão para acessar este formulário." />;
  }

  if (modo === 'editar' && ordemServicoQuery.isLoading) {
    return <LoadingState message="Carregando ordem de serviço..." />;
  }

  if (modo === 'editar' && ordemServicoQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar a ordem de serviço."
        onRetry={() => ordemServicoQuery.refetch()}
      />
    );
  }

  if (clientesQuery.isLoading || categoriasQuery.isLoading) {
    return <LoadingState message="Carregando dados do formulário..." />;
  }

  if (clientesQuery.isError || categoriasQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar clientes ou categorias de serviço."
        onRetry={() => {
          clientesQuery.refetch();
          categoriasQuery.refetch();
        }}
      />
    );
  }

  const opcoesClientes = (clientesQuery.data ?? []).map((cliente) => ({
    value: cliente.id,
    label: cliente.nome,
  }));

  const opcoesCategorias = categoriasAtivas.map((categoria) => ({
    value: categoria.id,
    label: categoria.nome,
  }));

  return (
    <form className="os-form" onSubmit={handleSubmit}>
      <FormField label="Cliente" htmlFor="os-form-cliente" required>
        <Select
          id="os-form-cliente"
          name="cliente"
          value={form.clienteId}
          onChange={(value) => updateField('clienteId', value)}
          options={opcoesClientes}
          placeholder="Selecione um cliente"
        />
      </FormField>

      <FormField label="Categoria de serviço" htmlFor="os-form-categoria" required>
        <Select
          id="os-form-categoria"
          name="categoriaServico"
          value={form.categoriaServicoId}
          onChange={(value) => updateField('categoriaServicoId', value)}
          options={opcoesCategorias}
          placeholder="Selecione uma categoria"
        />
      </FormField>

      <FormField label="Descrição do problema" htmlFor="os-form-descricao" required>
        <textarea
          id="os-form-descricao"
          className="os-form-textarea"
          value={form.descricaoProblema}
          onChange={(event) => updateField('descricaoProblema', event.target.value)}
          rows={4}
          required
        />
      </FormField>

      <FormField label="Endereço de atendimento" htmlFor="os-form-endereco">
        <input
          id="os-form-endereco"
          type="text"
          className="os-form-input"
          value={form.enderecoAtendimento}
          onChange={(event) => updateField('enderecoAtendimento', event.target.value)}
        />
      </FormField>

      <FormField label="Prioridade" htmlFor="os-form-prioridade" required>
        <Select
          id="os-form-prioridade"
          name="prioridade"
          value={form.prioridade}
          onChange={(value) => updateField('prioridade', value as PrioridadeOrdemServico)}
          options={OPCOES_PRIORIDADE}
        />
      </FormField>

      {submitError && <span className="os-form-error">{submitError}</span>}

      <div className="os-form-actions">
        <button type="submit" className="os-form-submit" disabled={!isFormValido || isSubmitting}>
          {isSubmitting ? 'Salvando...' : modo === 'criar' ? 'Criar ordem de serviço' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
