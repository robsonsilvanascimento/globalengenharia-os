import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { OrdemServico, PaginatedResponse, StatusOrdemServico } from '../../types/api';

export interface OrdensServicoFiltros {
  status?: StatusOrdemServico;
  tecnico_id?: string;
  cliente_id?: string;
  page?: number;
}

/**
 * Fetches the paginated list of ordens de serviço, re-fetching automatically
 * whenever any of the filters change (they are all part of the query key).
 */
export function useOrdensServicoQuery(filtros: OrdensServicoFiltros) {
  return useQuery({
    queryKey: ['ordens-servico', filtros],
    queryFn: () =>
      httpClient.get<PaginatedResponse<OrdemServico>>('/ordens-servico', {
        status: filtros.status,
        tecnico_id: filtros.tecnico_id,
        cliente_id: filtros.cliente_id,
        page: filtros.page,
      }),
  });
}
