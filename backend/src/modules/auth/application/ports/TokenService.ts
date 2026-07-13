import type { PapelUsuario, Usuario } from '../../domain/Usuario';

/** Payload minimo extraido de um refresh token valido. */
export interface RefreshTokenPayload {
  usuarioId: string;
}

/** Payload minimo extraido de um access token valido. */
export interface AccessTokenPayload {
  usuarioId: string;
  papel: PapelUsuario;
}

/**
 * Porta para geracao/validacao de tokens de autenticacao.
 * Implementacao real: modules/auth/infrastructure/JwtTokenService.ts (jsonwebtoken).
 */
export interface TokenService {
  gerarAccessToken(usuario: Usuario): string;
  gerarRefreshToken(usuario: Usuario): string;
  validarRefreshToken(token: string): RefreshTokenPayload | null;
  validarAccessToken(token: string): AccessTokenPayload | null;
}
