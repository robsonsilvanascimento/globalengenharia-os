import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { ManutencaoPreventiva, ManutencaoPreventivaComDetalhe } from '../../../types/api';

export function useManutencoesPreventivasVencendo(dias: number = 30) {
  return useQuery({
    queryKey: ['manutencoes-preventivas', 'vencendo', dias],
    queryFn: () =>
      httpClient.get<ManutencaoPreventivaComDetalhe[]>('/manutencoes-preventivas', {
        vencendo_em_dias: dias,
      }),
  });
}

export function useManutencaoPreventiva(componenteId: string) {
  return useQuery({
    queryKey: ['manutencao-preventiva', componenteId],
    queryFn: () => httpClient.get<ManutencaoPreventiva>(`/componentes/${componenteId}/manutencao-preventiva`),
    enabled: !!componenteId,
  });
}

export function useCriarManutencaoPreventiva(componenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { intervalo_dias: number }) =>
      httpClient.post<ManutencaoPreventiva>(`/componentes/${componenteId}/manutencao-preventiva`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manutencao-preventiva', componenteId] }),
  });
}

export function useRegistrarRealizada(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      httpClient.patch<ManutencaoPreventiva>(`/manutencoes-preventivas/${id}/realizada`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['manutencoes-preventivas'] });
    },
  });
}
