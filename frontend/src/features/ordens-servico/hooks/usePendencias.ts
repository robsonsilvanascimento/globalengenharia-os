import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { FotoBase64Upload, PendenciaOS } from '../../../types/api';

export function usePendencias(osId: string) {
  return useQuery({
    queryKey: ['ordens-servico', osId, 'pendencias'],
    queryFn: () => httpClient.get<PendenciaOS[]>(`/ordens-servico/${osId}/pendencias`),
    enabled: Boolean(osId),
  });
}

interface RegistrarPendenciaBody {
  observacao: string;
  fotos: FotoBase64Upload[];
}

export function useRegistrarPendencia(osId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegistrarPendenciaBody) =>
      httpClient.post<PendenciaOS>(`/ordens-servico/${osId}/pendencias`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', osId, 'pendencias'] });
    },
  });
}
