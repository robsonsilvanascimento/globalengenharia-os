import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { RedefinirSenhaUseCase } from '../RedefinirSenhaUseCase';
import { TokenResetInvalidoError } from '../../domain/errors/TokenResetInvalidoError';
import type { Usuario } from '../../domain/Usuario';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';
import type { HashService } from '../ports/HashService';

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    nome: 'Fulano',
    email: 'fulano@example.com',
    senhaHash: 'hash-antigo',
    papel: 'atendente',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarDeps(overrides?: { usuarioEncontrado?: Usuario | null }) {
  const usuarioEncontrado =
    overrides?.usuarioEncontrado === undefined ? criarUsuarioFake() : overrides.usuarioEncontrado;

  const usuarioRepository: UsuarioRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findByResetTokenHash: vi.fn().mockResolvedValue(usuarioEncontrado),
    salvarTokenReset: vi.fn(),
    atualizarSenha: vi.fn().mockResolvedValue(undefined),
  };

  const hashService: HashService = {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hash-novo'),
  };

  return { usuarioRepository, hashService };
}

describe('RedefinirSenhaUseCase', () => {
  it('com token valido: hasheia a nova senha e chama atualizarSenha (que invalida o token)', async () => {
    const deps = criarDeps();
    const useCase = new RedefinirSenhaUseCase(deps);

    await useCase.execute({ token: 'token-em-claro', novaSenha: 'nova-senha-123' });

    const tokenHashEsperado = createHash('sha256').update('token-em-claro').digest('hex');
    expect(deps.usuarioRepository.findByResetTokenHash).toHaveBeenCalledWith(tokenHashEsperado);
    expect(deps.hashService.hash).toHaveBeenCalledWith('nova-senha-123');
    expect(deps.usuarioRepository.atualizarSenha).toHaveBeenCalledWith('user-1', 'hash-novo');
  });

  it('lanca TokenResetInvalidoError quando o token nao e encontrado (invalido, expirado ou nunca gerado)', async () => {
    const deps = criarDeps({ usuarioEncontrado: null });
    const useCase = new RedefinirSenhaUseCase(deps);

    await expect(
      useCase.execute({ token: 'token-invalido', novaSenha: 'nova-senha-123' }),
    ).rejects.toBeInstanceOf(TokenResetInvalidoError);

    expect(deps.usuarioRepository.atualizarSenha).not.toHaveBeenCalled();
  });
});
