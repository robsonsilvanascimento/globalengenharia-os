/** Entidade de dominio FaqEntry. Nao carrega nenhum detalhe de persistencia. */
export interface FaqEntry {
  id: string;
  pergunta: string;
  resposta: string;
  tags: string | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}
