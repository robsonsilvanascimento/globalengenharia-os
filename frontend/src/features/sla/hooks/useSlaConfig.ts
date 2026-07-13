import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { SlaConfig } from '../../../types/sla';

export function useSlaConfig() {
  return useQuery({
    queryKey: ['sla-config'],
    queryFn: () => httpClient.get<SlaConfig[]>('/sla/config'),
    staleTime: 300_000,
  });
}
