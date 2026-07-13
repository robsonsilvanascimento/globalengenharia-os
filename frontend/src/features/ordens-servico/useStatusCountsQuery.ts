import { useQueries } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type { PaginatedResponse, OrdemServico, StatusOrdemServico } from '../../types/api';

export const STATUS_ORDEM: StatusOrdemServico[] = [
  'aberta',
  'triagem',
  'atribuida',
  'em_andamento',
  'aguardando_peca',
  'concluida',
  'cancelada',
];

/**
 * Busca, em paralelo, o total de OS por status (um request por status, cada
 * um pedindo só 1 registro — o que importa é o `total` da paginação, não os
 * dados). Usado para os balões de resumo do dashboard. Não é afetado pelos
 * filtros da tabela: sempre reflete a contagem geral por status.
 */
export function useStatusCountsQuery() {
  const results = useQueries({
    queries: STATUS_ORDEM.map((status) => ({
      queryKey: ['ordens-servico-count', status],
      queryFn: () =>
        httpClient.get<PaginatedResponse<OrdemServico>>('/ordens-servico', {
          status,
          page: 1,
          page_size: 1,
        }),
      staleTime: 30_000,
    })),
  });

  const isLoading = results.some((result) => result.isLoading);
  const isError = results.some((result) => result.isError);

  const counts = STATUS_ORDEM.reduce<Record<StatusOrdemServico, number>>(
    (acc, status, index) => {
      acc[status] = results[index]?.data?.total ?? 0;
      return acc;
    },
    {} as Record<StatusOrdemServico, number>,
  );

  return { counts, isLoading, isError };
}
