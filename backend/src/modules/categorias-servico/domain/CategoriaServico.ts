/** Area de atuacao do servico. Espelha o enum AreaServico do Prisma. */
export type AreaServico = 'eletrica' | 'automacao' | 'energia_solar' | 'outro';

/** Entidade de dominio CategoriaServico. Nao carrega nenhum detalhe de persistencia. */
export interface CategoriaServico {
  id: string;
  nome: string;
  area: AreaServico;
  ativo: boolean;
  criadoEm: Date;
}
