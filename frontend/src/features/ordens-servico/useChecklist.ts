import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { httpClient } from '../../lib/api/httpClient';
import type { ChecklistOS } from '../../types/api';

interface ResponderChecklistPayload {
  respostas: { itemId: string; marcado: boolean }[];
}

export function useChecklist(osId: string) {
  return useQuery({
    queryKey: ['checklist', osId],
    queryFn: () => httpClient.get<ChecklistOS>(`/ordens-servico/${osId}/checklist`),
    staleTime: 0,
  });
}

export function useResponderChecklist(osId: string) {
  return useMutation({
    mutationFn: (payload: ResponderChecklistPayload) =>
      httpClient.put<ChecklistOS>(`/ordens-servico/${osId}/checklist`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', osId] });
    },
  });
}
