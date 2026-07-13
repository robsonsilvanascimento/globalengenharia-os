/** Entidade de dominio Cliente. Nao carrega nenhum detalhe de persistencia. */
export interface Cliente {
  id: string;
  nome: string;
  telefoneWhatsapp: string;
  documento?: string | null;
  email?: string | null;
  criadoEm: Date;
}
