import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { FaqEntry } from '../../types/api';

export const FAQ_QUERY_KEY = ['faq'] as const;

/**
 * Fetches all FAQ entries (active and inactive). This is an admin screen
 * that needs the full list to manage the `ativo` flag, so it always asks
 * the API for inactive entries too via `incluir_inativas=true`.
 */
export function useFaqQuery() {
  return useQuery({
    queryKey: FAQ_QUERY_KEY,
    queryFn: () => httpClient.get<FaqEntry[]>('/faq', { incluir_inativas: true }),
  });
}
