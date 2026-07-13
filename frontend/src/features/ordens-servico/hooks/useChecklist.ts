import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { ChecklistOS, RespostaChecklist } from '../../../types/api';

export function useChecklist(osId: string) {
  return useQuery({
    queryKey: ['ordens-servico', osId, 'checklist'],
    queryFn: () => httpClient.get<ChecklistOS>(`/ordens-servico/${osId}/checklist`),
    enabled: Boolean(osId),
  });
}

export function useResponderChecklist(osId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (respostas: RespostaChecklist[]) =>
      httpClient.put<ChecklistOS>(`/ordens-servico/${osId}/checklist/respostas`, { respostas }),
    onSuccess: (data) => {
      queryClient.setQueryData(['ordens-servico', osId, 'checklist'], data);
    },
  });
}
