import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { SolicitacaoAtendimento } from '../../types/api';

export const SOLICITACOES_ATENDIMENTO_PENDENTES_QUERY_KEY = ['solicitacoes-atendimento', 'pendente'] as const;

/** Fetches the pending human-support requests (status=pendente). */
export function useSolicitacoesAtendimentoQuery() {
  return useQuery({
    queryKey: SOLICITACOES_ATENDIMENTO_PENDENTES_QUERY_KEY,
    queryFn: () =>
      httpClient.get<SolicitacaoAtendimento[]>('/solicitacoes-atendimento', { status: 'pendente' }),
  });
}
