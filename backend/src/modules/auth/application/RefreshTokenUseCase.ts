import type { UsuarioRepository } from '../domain/UsuarioRepository';
import { TokenInvalidoError } from '../domain/errors/TokenInvalidoError';
import type { TokenService } from './ports/TokenService';

export interface RefreshTokenUseCaseInput {
  refreshToken: string;
}

export interface RefreshTokenUseCaseOutput {
  accessToken: string;
}

export interface RefreshTokenUseCaseDeps {
  usuarioRepository: UsuarioRepository;
  tokenService: TokenService;
}

/**
 * Emite um novo access token a partir de um refresh token valido.
 * Lanca TokenInvalidoError se o token for invalido/expirado ou o usuario nao existir/estiver inativo.
 */
export class RefreshTokenUseCase {
  constructor(private readonly deps: RefreshTokenUseCaseDeps) {}

  async execute({ refreshToken }: RefreshTokenUseCaseInput): Promise<RefreshTokenUseCaseOutput> {
    const { usuarioRepository, tokenService } = this.deps;

    const payload = tokenService.validarRefreshToken(refreshToken);

    if (!payload) {
      throw new TokenInvalidoError();
    }

    const usuario = await usuarioRepository.findById(payload.usuarioId);

    if (!usuario || !usuario.ativo) {
      throw new TokenInvalidoError();
    }

    const accessToken = tokenService.gerarAccessToken(usuario);

    return { accessToken };
  }
}
