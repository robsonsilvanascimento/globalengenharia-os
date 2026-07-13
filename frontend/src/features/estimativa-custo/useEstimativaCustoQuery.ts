import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { EstimativaCustoOS, EstimativaCustoOSRequest } from '../../types/api';

function estimativaCustoQueryKey(ordemServicoId: string | undefined) {
  return ['ordens-servico', ordemServicoId, 'estimativa-custo'] as const;
}

/** Fetches the cost estimate of an OS (`null` when not yet calculated). Restricted to `admin`. */
export function useEstimativaCustoQuery(ordemServicoId: string | undefined) {
  return useQuery({
    queryKey: estimativaCustoQueryKey(ordemServicoId),
    queryFn: () => httpClient.get<EstimativaCustoOS | null>(`/ordens-servico/${ordemServicoId}/estimativa-custo`),
    enabled: Boolean(ordemServicoId),
  });
}

/** Saves (creates/updates) the cost estimate of an OS and refreshes the query on success. */
export function useSalvarEstimativaCustoMutation(ordemServicoId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: EstimativaCustoOSRequest) =>
      httpClient.put<EstimativaCustoOS>(`/ordens-servico/${ordemServicoId}/estimativa-custo`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(estimativaCustoQueryKey(ordemServicoId), data);
    },
  });
}
