import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { httpClient } from '../../lib/api/httpClient';
import type { FotoEvidencia } from '../../types/api';

interface AdicionarFotoEvidenciaPayload {
  mimeType: string;
  base64: string;
  legenda?: string;
}

export function useFotosEvidencia(osId: string) {
  return useQuery({
    queryKey: ['fotos-evidencia', osId],
    queryFn: () => httpClient.get<FotoEvidencia[]>(`/ordens-servico/${osId}/fotos-servico`),
    staleTime: 30_000,
  });
}

export function useAdicionarFotoEvidencia(osId: string) {
  return useMutation({
    mutationFn: (payload: AdicionarFotoEvidenciaPayload) =>
      httpClient.post<FotoEvidencia>(`/ordens-servico/${osId}/fotos-servico`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fotos-evidencia', osId] });
    },
  });
}
