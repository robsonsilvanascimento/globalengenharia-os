import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { ResultadosNPS } from '../../../types/api';

export function useResultadosNps(dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['nps-resultados', dataInicio, dataFim],
    queryFn: () =>
      httpClient.get<ResultadosNPS>('/nps/resultados', {
        ...(dataInicio && { dataInicio }),
        ...(dataFim && { dataFim }),
      }),
  });
}
