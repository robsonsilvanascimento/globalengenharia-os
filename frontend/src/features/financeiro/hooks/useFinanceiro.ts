import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type {
  ResumoFinanceiro,
  OSInadimplente,
  RankingTecnico,
  PagamentoOS,
} from '../../../types/api';

export function useResumoFinanceiro(dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['financeiro-resumo', dataInicio, dataFim],
    queryFn: () =>
      httpClient.get<ResumoFinanceiro>('/financeiro/resumo', { dataInicio, dataFim }),
  });
}

export function useInadimplentes() {
  return useQuery({
    queryKey: ['financeiro-inadimplentes'],
    queryFn: () => httpClient.get<OSInadimplente[]>('/financeiro/inadimplentes'),
  });
}

export function useRankingTecnicos(dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['financeiro-ranking', dataInicio, dataFim],
    queryFn: () =>
      httpClient.get<RankingTecnico[]>('/financeiro/ranking-tecnicos', { dataInicio, dataFim }),
  });
}

export function usePagamentosOS(osId: string) {
  return useQuery({
    queryKey: ['pagamentos-os', osId],
    queryFn: () => httpClient.get<PagamentoOS[]>(`/ordens-servico/${osId}/pagamentos`),
    enabled: !!osId,
  });
}

export function useGerarPix(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => httpClient.post<PagamentoOS>(`/ordens-servico/${osId}/pagamentos/pix`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagamentos-os', osId] }),
  });
}

export function useRegistrarPagamentoManual(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { valor: number; observacao?: string }) =>
      httpClient.post<PagamentoOS>(`/ordens-servico/${osId}/pagamentos/manual`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagamentos-os', osId] }),
  });
}

export function useAtualizarComissaoTecnico(usuarioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { comissao_ativa: boolean; comissao_pct: number }) =>
      httpClient.patch(`/usuarios/${usuarioId}/comissao`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
