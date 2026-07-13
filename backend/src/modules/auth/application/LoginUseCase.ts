import type { UsuarioRepository } from '../domain/UsuarioRepository';
import type { UsuarioPublico } from '../domain/Usuario';
import { CredenciaisInvalidasError } from '../domain/errors/CredenciaisInvalidasError';
import type { HashService } from './ports/HashService';
import type { TokenService } from './ports/TokenService';

export interface LoginUseCaseInput {
  email: string;
  senha: string;
}

export interface LoginUseCaseOutput {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioPublico;
}

export interface LoginUseCaseDeps {
  usuarioRepository: UsuarioRepository;
  hashService: HashService;
  tokenService: TokenService;
}

/**
 * Autentica um usuario por email/senha e emite o par de tokens (access + refresh).
 * Lanca CredenciaisInvalidasError se o usuario nao existir, estiver inativo ou a senha nao conferir.
 */
export class LoginUseCase {
  constructor(private readonly deps: LoginUseCaseDeps) {}

  async execute({ email, senha }: LoginUseCaseInput): Promise<LoginUseCaseOutput> {
    const { usuarioRepository, hashService, tokenService } = this.deps;

    const usuario = await usuarioRepository.findByEmail(email);

    if (!usuario || !usuario.ativo) {
      throw new CredenciaisInvalidasError();
    }

    const senhaConfere = await hashService.compare(senha, usuario.senhaHash);

    if (!senhaConfere) {
      throw new CredenciaisInvalidasError();
    }

    const accessToken = tokenService.gerarAccessToken(usuario);
    const refreshToken = tokenService.gerarRefreshToken(usuario);

    return {
      accessToken,
      refreshToken,
      usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    };
  }
}
