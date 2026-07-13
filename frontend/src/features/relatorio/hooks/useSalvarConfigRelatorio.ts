import { useMutation } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';

export interface ConfigRelatorio {
  frequencia: 'semanal' | 'mensal';
  email_destino: string;
}

export function useSalvarConfigRelatorio() {
  return useMutation({
    mutationFn: (config: ConfigRelatorio) =>
      httpClient.post<void>('/relatorio-gerencial/config', config),
  });
}
