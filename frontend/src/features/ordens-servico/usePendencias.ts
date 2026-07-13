import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { httpClient } from '../../lib/api/httpClient';
import type { FotoBase64Upload, PendenciaOS } from '../../types/api';

interface RegistrarPendenciaPayload {
  observacao: string;
  fotos: FotoBase64Upload[];
}

export function usePendencias(osId: string) {
  return useQuery({
    queryKey: ['pendencias', osId],
    queryFn: () => httpClient.get<PendenciaOS[]>(`/ordens-servico/${osId}/pendencias`),
    staleTime: 30_000,
  });
}

export function useRegistrarPendencia(osId: string) {
  return useMutation({
    mutationFn: (payload: RegistrarPendenciaPayload) =>
      httpClient.post<PendenciaOS>(`/ordens-servico/${osId}/pendencias`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendencias', osId] });
    },
  });
}
