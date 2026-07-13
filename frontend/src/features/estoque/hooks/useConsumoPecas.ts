import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { ConsumoOSPecaResponse } from '../../../types/api';

export function useConsumoPecas(osId: string) {
  return useQuery({
    queryKey: ['consumo-pecas', osId],
    queryFn: () => httpClient.get<ConsumoOSPecaResponse>(`/ordens-servico/${osId}/consumo-pecas`),
    enabled: !!osId,
  });
}

export function useAdicionarConsumoPeca(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { peca_id: string; quantidade: number; preco_unitario?: number }) =>
      httpClient.post(`/ordens-servico/${osId}/consumo-pecas`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumo-pecas', osId] }),
  });
}

export function useRemoverConsumoPeca(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (consumoId: string) =>
      httpClient.delete(`/ordens-servico/${osId}/consumo-pecas/${consumoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumo-pecas', osId] }),
  });
}
