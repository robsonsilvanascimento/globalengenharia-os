import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PapelUsuario } from '../../../modules/auth/domain/Usuario';
import type { UsuarioRepository } from '../../../modules/auth/domain/UsuarioRepository';
import { JwtTokenService } from '../../../modules/auth/infrastructure/JwtTokenService';
import { PrismaUsuarioRepository } from '../../../modules/auth/infrastructure/PrismaUsuarioRepository';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * Papeis de usuario para o RBAC. Espelha o enum PapelUsuario do dominio/Prisma.
 */
export type Papel = PapelUsuario;

export interface AuthenticatedUser {
  id: string;
  papel: Papel;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

// Instancia unica: so depende de env vars (JWT_SECRET/JWT_REFRESH_SECRET), sem estado por requisicao.
const tokenService = new JwtTokenService();

function extrairTokenDoHeader(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

/**
 * So valida o JWT (assinatura + expiracao), sem confirmar no banco que o
 * usuario ainda esta ativo ou mantem o mesmo papel — usa o papel gravado no
 * token no momento do login. Existe como seam de teste para suites de rota
 * que rodam sem Postgres (repositorios fake/in-memory); em producao, use
 * sempre `authenticate` (default export), que faz a checagem completa.
 */
export async function authenticateApenasToken(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extrairTokenDoHeader(request);

  if (!token) {
    throw new UnauthorizedError('Token de autenticacao ausente');
  }

  const payload = tokenService.validarAccessToken(token);

  if (!payload) {
    throw new UnauthorizedError('Token de autenticacao invalido ou expirado');
  }

  request.user = { id: payload.usuarioId, papel: payload.papel };
}

/**
 * Cria o hook de autenticacao Fastify: valida o JWT (`authenticateApenasToken`)
 * e depois reconfirma no banco que o usuario ainda existe e esta ativo,
 * usando o papel atual gravado la (nao o que veio no token). Sem essa
 * segunda checagem, desativar um usuario ou mudar seu papel so teria efeito
 * quando o access token dele expirasse — ate la, um funcionario demitido ou
 * rebaixado continuaria com as permissoes antigas.
 */
export function createAuthenticate(usuarioRepository: UsuarioRepository) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authenticateApenasToken(request, reply);

    const usuario = await usuarioRepository.findById(request.user!.id);

    if (!usuario || !usuario.ativo) {
      request.user = undefined;
      throw new UnauthorizedError('Usuario inativo ou nao encontrado');
    }

    request.user = { id: usuario.id, papel: usuario.papel };
  };
}

/** Hook de autenticacao Fastify usado em producao — ver `createAuthenticate`. */
export const authenticate = createAuthenticate(new PrismaUsuarioRepository());

/**
 * Retorna um preHandler Fastify que garante que `request.user.papel` esta entre
 * os papeis permitidos. Deve ser usado depois de `authenticate`. Lanca
 * UnauthorizedError se nao houver usuario autenticado, ForbiddenError (403) caso
 * o papel nao seja permitido.
 */
export function requireRole(roles: Papel[]) {
  return async function requireRoleHandler(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Nao autenticado');
    }

    if (!roles.includes(request.user.papel)) {
      throw new ForbiddenError('Acesso negado para o papel atual');
    }
  };
}
