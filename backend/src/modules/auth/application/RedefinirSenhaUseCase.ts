import { createHash } from 'node:crypto';
import type { UsuarioRepository } from '../domain/UsuarioRepository';
import { TokenResetInvalidoError } from '../domain/errors/TokenResetInvalidoError';
import type { HashService } from './ports/HashService';

export interface RedefinirSenhaUseCaseInput {
  token: string;
  novaSenha: string;
}

export interface RedefinirSenhaUseCaseDeps {
  usuarioRepository: UsuarioRepository;
  hashService: HashService;
}

/**
 * Conclui o fluxo de "esqueci minha senha": valida o token em texto puro
 * (comparando o hash SHA-256 dele contra o persistido) e, se valido e nao
 * expirado, atualiza a senha do usuario e invalida o token.
 * Lanca TokenResetInvalidoError se o token nao for encontrado/estiver expirado.
 */
export class RedefinirSenhaUseCase {
  constructor(private readonly deps: RedefinirSenhaUseCaseDeps) {}

  async execute({ token, novaSenha }: RedefinirSenhaUseCaseInput): Promise<void> {
    const { usuarioRepository, hashService } = this.deps;

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const usuario = await usuarioRepository.findByResetTokenHash(tokenHash);

    if (!usuario) {
      throw new TokenResetInvalidoError();
    }

    const novaSenhaHash = await hashService.hash(novaSenha);
    await usuarioRepository.atualizarSenha(usuario.id, novaSenhaHash);
  }
}
