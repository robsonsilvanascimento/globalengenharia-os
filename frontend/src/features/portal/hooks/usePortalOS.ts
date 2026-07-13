import { useQuery } from '@tanstack/react-query';
import { createPortalClient } from '../../../lib/api/portalClient';
import type { PortalOS, PortalOSDetalhe } from '../../../types/api';

export function usePortalOSList(token: string) {
  const client = createPortalClient(token);
  return useQuery({
    queryKey: ['portal-os', token],
    queryFn: () => client.get<PortalOS[]>('/portal/os').then(r => r.data),
    enabled: !!token,
  });
}

export function usePortalOSDetalhe(token: string, osId: string) {
  const client = createPortalClient(token);
  return useQuery({
    queryKey: ['portal-os', token, osId],
    queryFn: () => client.get<PortalOSDetalhe>(`/portal/os/${osId}`).then(r => r.data),
    enabled: !!token && !!osId,
  });
}
