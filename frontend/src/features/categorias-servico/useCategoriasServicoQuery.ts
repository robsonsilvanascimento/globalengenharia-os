import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { CategoriaServico } from '../../types/api';

export const CATEGORIAS_SERVICO_QUERY_KEY = ['categorias-servico'] as const;

/**
 * Fetches all categorias de serviço (active and inactive). Filtering by
 * área/ativo is done client-side in the page, since this is an admin screen
 * that needs the full list to manage the `ativo` flag.
 */
export function useCategoriasServicoQuery() {
  return useQuery({
    queryKey: CATEGORIAS_SERVICO_QUERY_KEY,
    queryFn: () => httpClient.get<CategoriaServico[]>('/categorias-servico'),
  });
}
