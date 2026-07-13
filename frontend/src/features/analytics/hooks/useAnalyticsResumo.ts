import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { AnalyticsResumo } from '../../../types/analytics';

export interface AnalyticsResumoFiltros {
  dataInicio?: string;
  dataFim?: string;
}

export function useAnalyticsResumo(filtros?: AnalyticsResumoFiltros) {
  return useQuery({
    queryKey: ['analytics-resumo', filtros],
    queryFn: () =>
      httpClient.get<AnalyticsResumo>('/analytics/resumo', {
        data_inicio: filtros?.dataInicio,
        data_fim: filtros?.dataFim,
      }),
    staleTime: 60_000,
  });
}
