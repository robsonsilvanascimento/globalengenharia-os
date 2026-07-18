import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAuthenticate } from '../auth';
import { JwtTokenService } from '../../../../modules/auth/infrastructure/JwtTokenService';
import type { Usuario } from '../../../../modules/auth/domain/Usuario';
import type { UsuarioRepository } from '../../../../modules/auth/domain/UsuarioRepository';

process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

class FakeUsuarioRepository implements UsuarioRepository {
  constructor(private readonly usuarios: Usuario[]) {}
  async findById(id: string) {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }
  async findByEmail() {
    return null;
  }
  async create(): Promise<Usuario> {
    throw new Error('nao usado neste teste');
  }
  async list() {
    return this.usuarios;
  }
  async update(): Promise<Usuario> {
    throw new Error('nao usado neste teste');
  }
  async findByResetTokenHash(): Promise<Usuario | null> {
    throw new Error('nao usado neste teste');
  }
  async salvarTokenReset(): Promise<void> {
    throw new Error('nao usado neste teste');
  }
  async atualizarSenha(): Promise<void> {
    throw new Error('nao usado neste teste');
  }
}

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-1',
    nome: 'Fulano',
    email: 'fulano@example.com',
    senhaHash: 'hash-fake',
    papel: 'atendente',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function buildRequest(token: string): FastifyRequest {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as FastifyRequest;
}

describe('createAuthenticate', () => {
  const tokenService = new JwtTokenService();
  let tokenUsuarioAtivo: string;
  let tokenUsuarioInativo: string;
  let tokenUsuarioInexistente: string;
  let tokenComPapelDesatualizado: string;

  beforeAll(() => {
    tokenUsuarioAtivo = tokenService.gerarAccessToken(criarUsuarioFake({ id: 'ativo-1', papel: 'atendente' }));
    tokenUsuarioInativo = tokenService.gerarAccessToken(criarUsuarioFake({ id: 'inativo-1', papel: 'atendente' }));
    tokenUsuarioInexistente = tokenService.gerarAccessToken(
      criarUsuarioFake({ id: 'nao-existe-mais', papel: 'atendente' }),
    );
    // Token emitido quando o usuario ainda era "tecnico"; no banco ele foi promovido a "admin".
    tokenComPapelDesatualizado = tokenService.gerarAccessToken(
      criarUsuarioFake({ id: 'promovido-1', papel: 'tecnico' }),
    );
  });

  it('autentica normalmente um usuario ativo, populando request.user com o papel atual do banco', async () => {
    const repo = new FakeUsuarioRepository([criarUsuarioFake({ id: 'ativo-1', papel: 'atendente', ativo: true })]);
    const authenticate = createAuthenticate(repo);
    const request = buildRequest(tokenUsuarioAtivo);

    await authenticate(request, {} as FastifyReply);

    expect(request.user).toEqual({ id: 'ativo-1', papel: 'atendente' });
  });

  it('rejeita um usuario desativado no banco mesmo com um access token ainda valido', async () => {
    const repo = new FakeUsuarioRepository([criarUsuarioFake({ id: 'inativo-1', papel: 'atendente', ativo: false })]);
    const authenticate = createAuthenticate(repo);
    const request = buildRequest(tokenUsuarioInativo);

    await expect(authenticate(request, {} as FastifyReply)).rejects.toMatchObject({
      message: expect.stringContaining('inativo'),
    });
    expect(request.user).toBeUndefined();
  });

  it('rejeita um token cujo usuario nao existe mais no banco', async () => {
    const repo = new FakeUsuarioRepository([]);
    const authenticate = createAuthenticate(repo);
    const request = buildRequest(tokenUsuarioInexistente);

    await expect(authenticate(request, {} as FastifyReply)).rejects.toThrow();
    expect(request.user).toBeUndefined();
  });

  it('usa o papel atual do banco, nao o papel gravado no token no momento do login', async () => {
    const repo = new FakeUsuarioRepository([
      criarUsuarioFake({ id: 'promovido-1', papel: 'admin', ativo: true }),
    ]);
    const authenticate = createAuthenticate(repo);
    const request = buildRequest(tokenComPapelDesatualizado);

    await authenticate(request, {} as FastifyReply);

    expect(request.user).toEqual({ id: 'promovido-1', papel: 'admin' });
  });

  it('rejeita token ausente', async () => {
    const repo = new FakeUsuarioRepository([]);
    const authenticate = createAuthenticate(repo);
    const request = { headers: {} } as unknown as FastifyRequest;

    await expect(authenticate(request, {} as FastifyReply)).rejects.toThrow();
  });
});
