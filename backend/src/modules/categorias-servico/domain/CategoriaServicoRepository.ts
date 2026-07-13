import type { AreaServico, CategoriaServico } from './CategoriaServico';

/** Dados necessarios para criar uma CategoriaServico. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarCategoriaServicoDados {
  nome: string;
  area: AreaServico;
  ativo?: boolean;
}

/** Dados parciais aceitos em uma atualizacao de CategoriaServico. */
export interface AtualizarCategoriaServicoDados {
  nome?: string;
  area?: AreaServico;
  ativo?: boolean;
}

/**
 * Contrato de persistencia para CategoriaServico. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 */
export interface CategoriaServicoRepository {
  /** Lista categorias. Quando `incluirInativas` for false, retorna somente as ativas. */
  list(incluirInativas: boolean): Promise<CategoriaServico[]>;
  findById(id: string): Promise<CategoriaServico | null>;
  create(dados: CriarCategoriaServicoDados): Promise<CategoriaServico>;
  update(id: string, dados: AtualizarCategoriaServicoDados): Promise<CategoriaServico>;
}
