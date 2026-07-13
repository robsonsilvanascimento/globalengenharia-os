import type { PapelUsuario, Usuario } from './Usuario';

/** Dados necessarios para criar um Usuario. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarUsuarioDados {
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
  ativo?: boolean;
  telefone?: string;
  valorHora?: number;
}

/** Dados parciais aceitos em uma atualizacao de Usuario. */
export interface AtualizarUsuarioDados {
  nome?: string;
  email?: string;
  senhaHash?: string;
  papel?: PapelUsuario;
  ativo?: boolean;
  telefone?: string | null;
  valorHora?: number | null;
}

/**
 * Contrato de persistencia para Usuario. Nenhum detalhe de Prisma/SQL vaza aqui —
 * a implementacao concreta (ex: repositorio Prisma) sera adicionada em fase seguinte.
 */
export interface UsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(dados: CriarUsuarioDados): Promise<Usuario>;
  list(): Promise<Usuario[]>;
  update(id: string, dados: AtualizarUsuarioDados): Promise<Usuario>;

  /**
   * Busca o usuario dono do hash de token de reset de senha informado.
   * Deve retornar null se o hash nao bater com nenhum usuario OU se o token
   * ja estiver expirado (a validacao de expiracao acontece aqui, na
   * implementacao de persistencia, filtrando `resetSenhaExpiraEm > agora`).
   */
  findByResetTokenHash(tokenHash: string): Promise<Usuario | null>;

  /** Persiste o hash do token de reset de senha e sua data de expiracao. */
  salvarTokenReset(usuarioId: string, tokenHash: string, expiraEm: Date): Promise<void>;

  /**
   * Atualiza a senha (ja hasheada) do usuario e invalida qualquer token de
   * reset pendente (limpa resetSenhaTokenHash/resetSenhaExpiraEm).
   */
  atualizarSenha(usuarioId: string, novaSenhaHash: string): Promise<void>;
}
