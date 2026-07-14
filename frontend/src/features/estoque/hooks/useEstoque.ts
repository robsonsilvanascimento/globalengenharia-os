import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/api/httpClient';
import type { Peca, MovimentacaoEstoque } from '../../../types/api';

interface PecasFiltros {
  ativo?: boolean;
  search?: string;
}

interface MovimentacoesFiltros {
  tipo?: string;
}

interface CriarPecaBody {
  codigo: string;
  nome: string;
  descricao?: string;
  unidade: string;
  precoUnitario: number;
  estoqueAtual: number;
  estoqueMinimo: number;
}

interface EntradaEstoqueBody {
  quantidade: number;
  observacao?: string;
}

export function usePecas(filtros?: PecasFiltros) {
  return useQuery({
    queryKey: ['pecas', filtros],
    queryFn: () =>
      httpClient.get<Peca[]>('/pecas', {
        ativo: filtros?.ativo,
        search: filtros?.search,
      }),
  });
}

export function usePeca(id: string) {
  return useQuery({
    queryKey: ['pecas', id],
    queryFn: () => httpClient.get<Peca>(`/pecas/${id}`),
    enabled: !!id,
  });
}

export function useCriarPeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CriarPecaBody) => httpClient.post<Peca>('/pecas', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pecas'] }),
  });
}

export function useAtualizarPeca(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CriarPecaBody>) => httpClient.put<Peca>(`/pecas/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pecas'] }),
  });
}

export function useToggleAtivoPeca(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ativo: boolean) => httpClient.patch<Peca>(`/pecas/${id}/ativo`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pecas'] }),
  });
}

export function useEntradaEstoque(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EntradaEstoqueBody) =>
      httpClient.post<MovimentacaoEstoque>(`/pecas/${id}/entradas`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pecas'] }),
  });
}

export function useAjusteEstoque(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { novoEstoque: number; observacao?: string }) =>
      httpClient.post<MovimentacaoEstoque>(`/pecas/${id}/ajuste`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pecas'] }),
  });
}

export function useMovimentacoesPeca(id: string, filtros?: MovimentacoesFiltros) {
  return useQuery({
    queryKey: ['pecas', id, 'movimentacoes', filtros],
    queryFn: () =>
      httpClient.get<MovimentacaoEstoque[]>(`/pecas/${id}/movimentacoes`, {
        tipo: filtros?.tipo,
      }),
    enabled: !!id,
  });
}
