import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { HistoricoOSClienteResponse } from '../../types/api';

export function useHistoricoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['historico-cliente', clienteId],
    queryFn: () =>
      httpClient.get<HistoricoOSClienteResponse>(`/clientes/${clienteId!}/historico-os`),
    enabled: clienteId !== undefined,
    staleTime: 30_000,
  });
}
