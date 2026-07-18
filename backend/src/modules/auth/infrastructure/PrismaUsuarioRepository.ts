import type { PrismaClient, Usuario as UsuarioPrisma } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { Usuario } from '../domain/Usuario';
import type {
  AtualizarUsuarioDados,
  CriarUsuarioDados,
  UsuarioRepository,
} from '../domain/UsuarioRepository';

/** Converte o registro do Prisma (Decimal) para a entidade de dominio (number). */
function paraEntidade(registro: UsuarioPrisma): Usuario {
  return {
    id: registro.id,
    nome: registro.nome,
    email: registro.email,
    senhaHash: registro.senhaHash,
    papel: registro.papel,
    ativo: registro.ativo,
    telefone: registro.telefone ?? null,
    valorHora: registro.valorHora ? Number(registro.valorHora) : null,
    criadoEm: registro.criadoEm,
  };
}

/** Implementacao de UsuarioRepository sobre o Prisma Client. */
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByEmail(email: string): Promise<Usuario | null> {
    // Normaliza para minusculas: sem isso, "User@x.com" e "user@x.com" sao
    // tratados como e-mails diferentes (unique constraint do Postgres e
    // case-sensitive por padrao), permitindo cadastros duplicados do mesmo
    // e-mail real e login inconsistente dependendo da capitalizacao digitada.
    const registro = await this.client.usuario.findUnique({ where: { email: email.toLowerCase() } });
    return registro ? paraEntidade(registro) : null;
  }

  async findById(id: string): Promise<Usuario | null> {
    const registro = await this.client.usuario.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async create(dados: CriarUsuarioDados): Promise<Usuario> {
    const registro = await this.client.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email.toLowerCase(),
        senhaHash: dados.senhaHash,
        papel: dados.papel,
        ativo: dados.ativo ?? true,
        telefone: dados.telefone,
        valorHora: dados.valorHora,
      },
    });
    return paraEntidade(registro);
  }

  async list(): Promise<Usuario[]> {
    const registros = await this.client.usuario.findMany({ orderBy: { criadoEm: 'desc' } });
    return registros.map(paraEntidade);
  }

  async update(id: string, dados: AtualizarUsuarioDados): Promise<Usuario> {
    const registro = await this.client.usuario.update({
      where: { id },
      data: { ...dados, email: dados.email?.toLowerCase() },
    });
    return paraEntidade(registro);
  }

  async findByResetTokenHash(tokenHash: string): Promise<Usuario | null> {
    // Filtra a expiracao aqui, na query: so retorna o usuario se o token
    // ainda nao tiver expirado (resetSenhaExpiraEm > agora).
    const registro = await this.client.usuario.findFirst({
      where: {
        resetSenhaTokenHash: tokenHash,
        resetSenhaExpiraEm: { gt: new Date() },
      },
    });
    return registro ? paraEntidade(registro) : null;
  }

  async salvarTokenReset(usuarioId: string, tokenHash: string, expiraEm: Date): Promise<void> {
    await this.client.usuario.update({
      where: { id: usuarioId },
      data: { resetSenhaTokenHash: tokenHash, resetSenhaExpiraEm: expiraEm },
    });
  }

  async atualizarSenha(usuarioId: string, novaSenhaHash: string): Promise<void> {
    await this.client.usuario.update({
      where: { id: usuarioId },
      data: {
        senhaHash: novaSenhaHash,
        resetSenhaTokenHash: null,
        resetSenhaExpiraEm: null,
      },
    });
  }
}
