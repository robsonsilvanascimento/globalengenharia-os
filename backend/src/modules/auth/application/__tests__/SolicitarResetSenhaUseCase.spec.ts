import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SolicitarResetSenhaUseCase } from '../SolicitarResetSenhaUseCase';
import type { Usuario } from '../../domain/Usuario';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';

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

function criarDeps(overrides?: { usuario?: Usuario | null }) {
  const usuario = overrides?.usuario === undefined ? criarUsuarioFake() : overrides.usuario;

  const usuarioRepository: UsuarioRepository = {
    findByEmail: vi.fn().mockResolvedValue(usuario),
    findById: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findByResetTokenHash: vi.fn(),
    salvarTokenReset: vi.fn().mockResolvedValue(undefined),
    atualizarSenha: vi.fn(),
  };

  const enviarEmail = vi.fn().mockResolvedValue({ sucesso: true });

  return { usuarioRepository, enviarEmail };
}

describe('SolicitarResetSenhaUseCase', () => {
  it('gera token, persiste o hash com expiracao de 1h e envia e-mail com link contendo o token em texto puro', async () => {
    const deps = criarDeps();
    const useCase = new SolicitarResetSenhaUseCase(deps);
    const antes = Date.now();

    await useCase.execute({ email: 'fulano@example.com' });

    expect(deps.usuarioRepository.findByEmail).toHaveBeenCalledWith('fulano@example.com');
    expect(deps.usuarioRepository.salvarTokenReset).toHaveBeenCalledTimes(1);

    const [usuarioId, tokenHash, expiraEm] = (
      deps.usuarioRepository.salvarTokenReset as ReturnType<typeof vi.fn>
    ).mock.calls[0];

    expect(usuarioId).toBe('user-1');
    expect(typeof tokenHash).toBe('string');
    expect(expiraEm.getTime()).toBeGreaterThanOrEqual(antes + 60 * 60 * 1000 - 5000);
    expect(expiraEm.getTime()).toBeLessThanOrEqual(antes + 60 * 60 * 1000 + 5000);

    expect(deps.enviarEmail).toHaveBeenCalledTimes(1);
    const [destinatario, , corpoTexto] = (deps.enviarEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(destinatario).toBe('fulano@example.com');
    expect(corpoTexto).toContain('/redefinir-senha?token=');

    // O token em texto puro (no e-mail) nunca e igual ao hash persistido.
    const tokenNoLink = corpoTexto.match(/token=([a-f0-9]+)/)?.[1];
    expect(tokenNoLink).toBeDefined();
    expect(tokenNoLink).not.toBe(tokenHash);
    expect(createHash('sha256').update(tokenNoLink as string).digest('hex')).toBe(tokenHash);
  });

  it('retorna silenciosamente (sem enviar e-mail) quando o e-mail nao existe na base', async () => {
    const deps = criarDeps({ usuario: null });
    const useCase = new SolicitarResetSenhaUseCase(deps);

    await expect(useCase.execute({ email: 'ninguem@example.com' })).resolves.toBeUndefined();

    expect(deps.usuarioRepository.salvarTokenReset).not.toHaveBeenCalled();
    expect(deps.enviarEmail).not.toHaveBeenCalled();
  });
});
