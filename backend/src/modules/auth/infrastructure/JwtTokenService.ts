import jwt from 'jsonwebtoken';
import type { PapelUsuario, Usuario } from '../domain/Usuario';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenService,
} from '../application/ports/TokenService';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/** Implementacao de TokenService usando jsonwebtoken (HS256). */
export class JwtTokenService implements TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor() {
    const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

    if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
      throw new Error('JWT_SECRET e JWT_REFRESH_SECRET precisam estar definidos no ambiente');
    }

    this.accessSecret = JWT_SECRET;
    this.refreshSecret = JWT_REFRESH_SECRET;
  }

  gerarAccessToken(usuario: Usuario): string {
    return jwt.sign({ sub: usuario.id, papel: usuario.papel }, this.accessSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  gerarRefreshToken(usuario: Usuario): string {
    return jwt.sign({ sub: usuario.id }, this.refreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  validarRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);

      if (typeof decoded === 'string' || !decoded.sub) {
        return null;
      }

      return { usuarioId: decoded.sub };
    } catch {
      return null;
    }
  }

  validarAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessSecret);

      if (typeof decoded === 'string' || !decoded.sub || !decoded.papel) {
        return null;
      }

      return { usuarioId: decoded.sub, papel: decoded.papel as PapelUsuario };
    } catch {
      return null;
    }
  }
}
