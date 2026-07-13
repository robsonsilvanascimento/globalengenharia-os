import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { HistoricoOSClienteResponse } from '../../../types/api';

export function useHistoricoCliente(clienteId: string) {
  return useQuery({
    queryKey: ['clientes', clienteId, 'historico-os'],
    queryFn: () => httpClient.get<HistoricoOSClienteResponse>(`/clientes/${clienteId}/historico-os`),
    enabled: Boolean(clienteId),
  });
}
