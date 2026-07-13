import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { AlertaGarantia } from '../../../types/alerta';

export interface AlertasGarantiaFiltros {
  lido?: boolean;
}

export function useAlertasGarantia(filtros?: AlertasGarantiaFiltros) {
  return useQuery({
    queryKey: ['alertas-garantia', filtros],
    queryFn: () =>
      httpClient.get<AlertaGarantia[]>('/alertas-garantia', {
        lido: filtros?.lido,
      }),
    staleTime: 30_000,
  });
}
