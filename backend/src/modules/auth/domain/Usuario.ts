/** Papel do usuario dentro do sistema (RBAC). Espelha o enum PapelUsuario do Prisma. */
export type PapelUsuario = 'atendente' | 'tecnico' | 'admin' | 'ajudante';

/** Entidade de dominio Usuario. Nao carrega nenhum detalhe de persistencia. */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
  ativo: boolean;
  telefone?: string | null;
  valorHora?: number | null;
  criadoEm: Date;
}

/** Usuario sem dados sensiveis, seguro para retornar em respostas HTTP/tokens. */
export type UsuarioPublico = Pick<Usuario, 'id' | 'nome' | 'papel'>;
