import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';

export type StatusContaReceber = 'aberta' | 'paga' | 'vencida' | 'cancelada';
export type Periodicidade = 'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export const PERIODICIDADE_ROTULO: Record<Periodicidade, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export interface ContaReceber {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nome: string | null;
  contrato_id: string | null;
  descricao: string;
  valor: number;
  vencimento_em: string;
  status: StatusContaReceber;
  pago_em: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  criado_em: string;
}

export interface ResumoContas {
  total_aberto: number;
  total_vencido: number;
  total_recebido: number;
  quantidade: number;
}

export interface ContratoRecorrente {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  descricao: string;
  valor: number;
  periodicidade: Periodicidade;
  proxima_cobranca_em: string;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface FiltroContas {
  status?: StatusContaReceber | '';
  cliente_id?: string;
}

// ===== Contas a receber =====

export function useContasReceber(filtro: FiltroContas) {
  return useQuery({
    queryKey: ['contas-receber', filtro],
    queryFn: () =>
      httpClient.get<{ contas: ContaReceber[]; resumo: ResumoContas }>('/contas-receber', {
        status: filtro.status || undefined,
        cliente_id: filtro.cliente_id || undefined,
      }),
  });
}

export interface CriarContaInput {
  cliente_id: string;
  descricao: string;
  valor: number;
  vencimento_em: string;
  observacao?: string | null;
}

export function useCriarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CriarContaInput) => httpClient.post<ContaReceber>('/contas-receber', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-receber'] }),
  });
}

export function useBaixarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, forma_pagamento, valor_pago }: { id: string; forma_pagamento?: string | null; valor_pago?: number }) =>
      httpClient.post<ContaReceber>(`/contas-receber/${id}/baixa`, { forma_pagamento, valor_pago }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-receber'] }),
  });
}

export function useCancelarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpClient.post<ContaReceber>(`/contas-receber/${id}/cancelar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-receber'] }),
  });
}

// ===== Contratos recorrentes =====

export function useContratos(filtro: { ativo?: string }) {
  return useQuery({
    queryKey: ['contratos-recorrentes', filtro],
    queryFn: () =>
      httpClient.get<ContratoRecorrente[]>('/contratos-recorrentes', {
        ativo: filtro.ativo || undefined,
      }),
  });
}

export interface CriarContratoInput {
  cliente_id: string;
  descricao: string;
  valor: number;
  periodicidade: Periodicidade;
  data_inicio: string;
  data_fim?: string | null;
}

export function useCriarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CriarContratoInput) => httpClient.post<ContratoRecorrente>('/contratos-recorrentes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contratos-recorrentes'] }),
  });
}

export function useAlternarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      httpClient.post<ContratoRecorrente>(`/contratos-recorrentes/${id}/${ativo ? 'ativar' : 'desativar'}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contratos-recorrentes'] }),
  });
}

export function useFaturarAgora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => httpClient.post<{ contas_geradas: number; contratos_processados: number }>('/contratos-recorrentes/faturar', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-recorrentes'] });
      qc.invalidateQueries({ queryKey: ['contas-receber'] });
    },
  });
}
