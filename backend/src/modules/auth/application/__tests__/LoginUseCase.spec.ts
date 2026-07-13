import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from '../LoginUseCase';
import { CredenciaisInvalidasError } from '../../domain/errors/CredenciaisInvalidasError';
import type { Usuario } from '../../domain/Usuario';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';
import type { HashService } from '../ports/HashService';
import type { TokenService } from '../ports/TokenService';

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    nome: 'Fulano',
    email: 'fulano@example.com',
    senhaHash: 'hash-fake',
    papel: 'atendente',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarDeps(overrides?: {
  usuario?: Usuario | null;
  senhaConfere?: boolean;
}) {
  const usuario = overrides?.usuario === undefined ? criarUsuarioFake() : overrides.usuario;
  const senhaConfere = overrides?.senhaConfere ?? true;

  const usuarioRepository: UsuarioRepository = {
    findByEmail: vi.fn().mockResolvedValue(usuario),
    findById: vi.fn().mockResolvedValue(usuario),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findByResetTokenHash: vi.fn(),
    salvarTokenReset: vi.fn(),
    atualizarSenha: vi.fn(),
  };

  const hashService: HashService = {
    compare: vi.fn().mockResolvedValue(senhaConfere),
    hash: vi.fn(),
  };

  const tokenService: TokenService = {
    gerarAccessToken: vi.fn().mockReturnValue('access-token-fake'),
    gerarRefreshToken: vi.fn().mockReturnValue('refresh-token-fake'),
    validarRefreshToken: vi.fn(),
    validarAccessToken: vi.fn(),
  };

  return { usuarioRepository, hashService, tokenService };
}

describe('LoginUseCase', () => {
  it('autentica com sucesso e retorna tokens + usuario publico', async () => {
    const deps = criarDeps();
    const useCase = new LoginUseCase(deps);

    const resultado = await useCase.execute({ email: 'fulano@example.com', senha: 'senha123' });

    expect(resultado).toEqual({
      accessToken: 'access-token-fake',
      refreshToken: 'refresh-token-fake',
      usuario: { id: 'user-1', nome: 'Fulano', papel: 'atendente' },
    });
    expect(resultado).not.toHaveProperty('usuario.senhaHash');
    expect(deps.usuarioRepository.findByEmail).toHaveBeenCalledWith('fulano@example.com');
    expect(deps.hashService.compare).toHaveBeenCalledWith('senha123', 'hash-fake');
  });

  it('lanca CredenciaisInvalidasError quando usuario nao existe', async () => {
    const deps = criarDeps({ usuario: null });
    const useCase = new LoginUseCase(deps);

    await expect(
      useCase.execute({ email: 'ninguem@example.com', senha: 'senha123' }),
    ).rejects.toBeInstanceOf(CredenciaisInvalidasError);
  });

  it('lanca CredenciaisInvalidasError quando usuario esta inativo', async () => {
    const deps = criarDeps({ usuario: criarUsuarioFake({ ativo: false }) });
    const useCase = new LoginUseCase(deps);

    await expect(
      useCase.execute({ email: 'fulano@example.com', senha: 'senha123' }),
    ).rejects.toBeInstanceOf(CredenciaisInvalidasError);
  });

  it('lanca CredenciaisInvalidasError quando a senha nao confere', async () => {
    const deps = criarDeps({ senhaConfere: false });
    const useCase = new LoginUseCase(deps);

    await expect(
      useCase.execute({ email: 'fulano@example.com', senha: 'senha-errada' }),
    ).rejects.toBeInstanceOf(CredenciaisInvalidasError);
  });
});
