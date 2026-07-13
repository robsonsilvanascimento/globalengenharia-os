import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';

export interface ApiKey {
  id: string;
  nome: string;
  prefixo: string;
  ativa: boolean;
  criadoEm: string;
  ultimoUsoEm: string | null;
}

export interface ApiKeyCreated {
  id: string;
  nome: string;
  prefixo: string;
  chave: string;
  criadoEm: string;
}

const QUERY_KEY = ['api-keys'] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => httpClient.get<ApiKey[]>('/api-keys'),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { nome: string }) => httpClient.post<ApiKeyCreated>('/api-keys', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpClient.delete<void>(`/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
