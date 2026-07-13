import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { ClienteResumo } from '../../types/api';

/** Fetches the OS summary (totals + history) of a single cliente. */
export function useClienteResumoQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['clientes', id, 'resumo'],
    queryFn: () => httpClient.get<ClienteResumo>(`/clientes/${id}/resumo`),
    enabled: Boolean(id),
  });
}
