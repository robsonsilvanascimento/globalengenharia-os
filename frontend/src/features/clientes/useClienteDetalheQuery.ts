import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { ClienteDetalhe } from '../../types/api';

/** Fetches the cadastral data of a single cliente. */
export function useClienteDetalheQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () => httpClient.get<ClienteDetalhe>(`/clientes/${id}`),
    enabled: Boolean(id),
  });
}
