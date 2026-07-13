import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { AlertaGarantia } from '../../../types/alerta';

export function useMarcarAlertaLido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      httpClient.patch<AlertaGarantia>(`/alertas-garantia/${id}/lido`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-garantia'] });
    },
  });
}
