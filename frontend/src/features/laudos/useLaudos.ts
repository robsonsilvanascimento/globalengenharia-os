import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';

export interface TrechoNormativo {
  id: string;
  norma: string;
  item: string | null;
  categoria: string;
  assunto: string;
  texto: string;
  itemVerificar: boolean;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CategoriaTrecho {
  valor: string;
  rotulo: string;
}

export interface TrechoFiltro {
  categoria?: string;
  norma?: string;
  busca?: string;
}

export interface SalvarTrechoInput {
  norma: string;
  item?: string;
  categoria: string;
  assunto: string;
  texto: string;
  item_verificar?: boolean;
}

const TRECHOS_KEY = ['laudos', 'trechos'] as const;

export function useCategoriasTrecho() {
  return useQuery({
    queryKey: ['laudos', 'categorias'],
    queryFn: () => httpClient.get<CategoriaTrecho[]>('/laudos/categorias'),
  });
}

export function useTrechos(filtro: TrechoFiltro) {
  return useQuery({
    queryKey: [...TRECHOS_KEY, filtro],
    queryFn: () =>
      httpClient.get<TrechoNormativo[]>('/laudos/trechos', {
        categoria: filtro.categoria || undefined,
        norma: filtro.norma || undefined,
        busca: filtro.busca || undefined,
      }),
  });
}

export function useCriarTrecho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SalvarTrechoInput) => httpClient.post<TrechoNormativo>('/laudos/trechos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRECHOS_KEY }),
  });
}

export function useAtualizarTrecho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SalvarTrechoInput }) =>
      httpClient.put<TrechoNormativo>(`/laudos/trechos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRECHOS_KEY }),
  });
}

export function useRemoverTrecho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpClient.delete<void>(`/laudos/trechos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRECHOS_KEY }),
  });
}

export interface Laudo {
  id: string;
  numero: string;
  titulo: string;
  tipo: string;
  clienteNome: string | null;
  conteudo: string;
  responsavelNome: string | null;
  responsavelCrea: string | null;
  artNumero: string | null;
  emitidoEm: string;
}

export interface SalvarLaudoInput {
  id?: string;
  ordem_servico_id?: string | null;
  titulo: string;
  tipo: string;
  cliente_nome?: string | null;
  conteudo: string;
  responsavel_nome?: string | null;
  responsavel_crea?: string | null;
  art_numero?: string | null;
}

export function useSalvarLaudo() {
  return useMutation({
    mutationFn: (body: SalvarLaudoInput) => httpClient.post<Laudo>('/laudos', body),
  });
}

/** Baixa/abre o PDF do laudo (com auth). Retorna a URL de blob para abrir em nova aba. */
export async function abrirLaudoPdf(id: string): Promise<void> {
  const blob = await httpClient.getBlob(`/laudos/${id}/pdf`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
