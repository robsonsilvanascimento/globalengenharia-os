import type {
  AtualizarTrechoInput,
  CriarTrechoInput,
  ListarTrechosFiltro,
  TrechoNormativo,
} from './TrechoNormativo';

export interface TrechoNormativoRepository {
  listar(filtro: ListarTrechosFiltro): Promise<TrechoNormativo[]>;
  buscarPorId(id: string): Promise<TrechoNormativo | null>;
  criar(dados: CriarTrechoInput): Promise<TrechoNormativo>;
  atualizar(id: string, dados: AtualizarTrechoInput): Promise<TrechoNormativo>;
  /** Desativa (soft delete) — preserva trechos ja referenciados em laudos antigos. */
  desativar(id: string): Promise<void>;
  contarAtivos(): Promise<number>;
  /** Insere varios de uma vez (usado pelo seed inicial). Retorna a quantidade criada. */
  criarVarios(lista: CriarTrechoInput[]): Promise<number>;
}
