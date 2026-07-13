import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { Cliente } from '../../types/api';

/** Fetches the full list of clientes (no pagination in the current API contract). */
export function useClientesQuery() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => httpClient.get<Cliente[]>('/clientes'),
  });
}
