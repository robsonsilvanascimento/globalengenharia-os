import type { LaudoFoto } from './LaudoFoto';

export interface CriarLaudoFotoDados {
  laudoId: string;
  chaveArquivo: string;
  mimeType: string;
  legenda?: string | null;
  ordem: number;
}

export interface LaudoFotoRepository {
  criar(dados: CriarLaudoFotoDados): Promise<LaudoFoto>;
  listarPorLaudo(laudoId: string): Promise<LaudoFoto[]>;
  buscarPorId(id: string): Promise<LaudoFoto | null>;
  /** Maior valor de `ordem` ja usado no laudo (para anexar a proxima foto ao fim). */
  maiorOrdem(laudoId: string): Promise<number>;
  atualizarLegenda(id: string, legenda: string | null): Promise<LaudoFoto>;
  remover(id: string): Promise<void>;
}
