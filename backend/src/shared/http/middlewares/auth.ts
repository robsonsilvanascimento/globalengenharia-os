import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PapelUsuario } from '../../../modules/auth/domain/Usuario';
import { JwtTokenService } from '../../../modules/auth/infrastructure/JwtTokenService';
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
 * Hook de autenticacao Fastify. Extrai o Bearer token do header Authorization,
 * valida o JWT (JwtTokenService) e popula `request.user`. Lanca UnauthorizedError
 * (401, tratado pelo error-handler global) se o token estiver ausente ou invalido.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
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
