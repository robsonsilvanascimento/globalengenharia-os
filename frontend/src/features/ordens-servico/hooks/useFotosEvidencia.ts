import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { FotoBase64Upload, FotoEvidencia, FotosEvidenciaResponse } from '../../../types/api';

export function useFotosEvidencia(osId: string) {
  return useQuery({
    queryKey: ['ordens-servico', osId, 'fotos-evidencia'],
    queryFn: () => httpClient.get<FotosEvidenciaResponse>(`/ordens-servico/${osId}/fotos-evidencia`),
    enabled: Boolean(osId),
  });
}

export function useAdicionarFotoEvidencia(osId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: FotoBase64Upload) =>
      httpClient.post<FotoEvidencia>(`/ordens-servico/${osId}/fotos-evidencia`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico', osId, 'fotos-evidencia'] });
    },
  });
}
