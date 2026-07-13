import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { SlaConfig } from '../../../types/sla';

export function useUpdateSlaConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prioridade, prazo_horas }: SlaConfig) =>
      httpClient.put<SlaConfig>(`/sla/config/${prioridade}`, { prazo_horas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-config'] });
    },
  });
}
