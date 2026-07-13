import { describe, expect, it, vi } from 'vitest';
import { RefreshTokenUseCase } from '../RefreshTokenUseCase';
import { TokenInvalidoError } from '../../domain/errors/TokenInvalidoError';
import type { Usuario } from '../../domain/Usuario';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';
import type { TokenService } from '../ports/TokenService';

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    nome: 'Fulano',
    email: 'fulano@example.com',
    senhaHash: 'hash-fake',
    papel: 'tecnico',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarDeps(overrides?: {
  usuario?: Usuario | null;
  payload?: { usuarioId: string } | null;
}) {
  const usuario = overrides?.usuario === undefined ? criarUsuarioFake() : overrides.usuario;
  const payload = overrides?.payload === undefined ? { usuarioId: 'user-1' } : overrides.payload;

  const usuarioRepository: UsuarioRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(usuario),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findByResetTokenHash: vi.fn(),
    salvarTokenReset: vi.fn(),
    atualizarSenha: vi.fn(),
  };

  const tokenService: TokenService = {
    gerarAccessToken: vi.fn().mockReturnValue('novo-access-token'),
    gerarRefreshToken: vi.fn(),
    validarRefreshToken: vi.fn().mockReturnValue(payload),
    validarAccessToken: vi.fn(),
  };

  return { usuarioRepository, tokenService };
}

describe('RefreshTokenUseCase', () => {
  it('gera novo access token quando o refresh token e valido e o usuario esta ativo', async () => {
    const deps = criarDeps();
    const useCase = new RefreshTokenUseCase(deps);

    const resultado = await useCase.execute({ refreshToken: 'refresh-valido' });

    expect(resultado).toEqual({ accessToken: 'novo-access-token' });
    expect(deps.tokenService.validarRefreshToken).toHaveBeenCalledWith('refresh-valido');
    expect(deps.usuarioRepository.findById).toHaveBeenCalledWith('user-1');
  });

  it('lanca TokenInvalidoError quando o refresh token e invalido', async () => {
    const deps = criarDeps({ payload: null });
    const useCase = new RefreshTokenUseCase(deps);

    await expect(useCase.execute({ refreshToken: 'refresh-invalido' })).rejects.toBeInstanceOf(
      TokenInvalidoError,
    );
  });

  it('lanca TokenInvalidoError quando o usuario associado nao existe mais', async () => {
    const deps = criarDeps({ usuario: null });
    const useCase = new RefreshTokenUseCase(deps);

    await expect(useCase.execute({ refreshToken: 'refresh-valido' })).rejects.toBeInstanceOf(
      TokenInvalidoError,
    );
  });

  it('lanca TokenInvalidoError quando o usuario associado esta inativo', async () => {
    const deps = criarDeps({ usuario: criarUsuarioFake({ ativo: false }) });
    const useCase = new RefreshTokenUseCase(deps);

    await expect(useCase.execute({ refreshToken: 'refresh-valido' })).rejects.toBeInstanceOf(
      TokenInvalidoError,
    );
  });
});
