import { createHash } from 'node:crypto';
import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../../shared/http/middlewares/error-handler';
import { registerAuthRoutes } from '../routes';
import { registerUsuariosRoutes } from '../usuarios-routes';
import { BcryptHashService } from '../../BcryptHashService';
import { JwtTokenService } from '../../JwtTokenService';
import type { Usuario } from '../../../domain/Usuario';
import type {
  AtualizarUsuarioDados,
  CriarUsuarioDados,
  UsuarioRepository,
} from '../../../domain/UsuarioRepository';

/**
 * Repositorio em memoria usado apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real no
 * ambiente de CI/local. LIMITACAO: nao cobre comportamento especifico do
 * Prisma/Postgres (constraints unique, tipos de coluna, etc.) — isso deve
 * ser validado por um teste de integracao real contra o banco quando houver
 * um ambiente de banco disponivel.
 */
class InMemoryUsuarioRepository implements UsuarioRepository {
  private usuarios: Usuario[] = [];
  private seq = 0;
  // Mapa auxiliar (nao faz parte da entidade de dominio Usuario) apenas para
  // simular as colunas resetSenhaTokenHash/resetSenhaExpiraEm do Prisma.
  private resetTokens = new Map<string, { hash: string; expiraEm: Date }>();

  seed(usuario: Usuario): void {
    this.usuarios.push(usuario);
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }

  async create(dados: CriarUsuarioDados): Promise<Usuario> {
    this.seq += 1;
    const usuario: Usuario = {
      id: `usuario-${this.seq}`,
      nome: dados.nome,
      email: dados.email,
      senhaHash: dados.senhaHash,
      papel: dados.papel,
      ativo: dados.ativo ?? true,
      telefone: dados.telefone ?? null,
      valorHora: dados.valorHora ?? null,
      criadoEm: new Date(),
    };
    this.usuarios.push(usuario);
    return usuario;
  }

  async list(): Promise<Usuario[]> {
    return [...this.usuarios];
  }

  async update(id: string, dados: AtualizarUsuarioDados): Promise<Usuario> {
    const usuario = this.usuarios.find((u) => u.id === id);
    if (!usuario) {
      throw new Error(`usuario ${id} nao encontrado`);
    }
    Object.assign(usuario, dados);
    return usuario;
  }

  async findByResetTokenHash(tokenHash: string): Promise<Usuario | null> {
    for (const [usuarioId, dados] of this.resetTokens.entries()) {
      if (dados.hash === tokenHash && dados.expiraEm.getTime() > Date.now()) {
        return this.usuarios.find((u) => u.id === usuarioId) ?? null;
      }
    }
    return null;
  }

  async salvarTokenReset(usuarioId: string, tokenHash: string, expiraEm: Date): Promise<void> {
    this.resetTokens.set(usuarioId, { hash: tokenHash, expiraEm });
  }

  async atualizarSenha(usuarioId: string, novaSenhaHash: string): Promise<void> {
    const usuario = this.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) {
      throw new Error(`usuario ${usuarioId} nao encontrado`);
    }
    usuario.senhaHash = novaSenhaHash;
    this.resetTokens.delete(usuarioId);
  }
}

describe('rotas de auth e usuarios (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let repository: InMemoryUsuarioRepository;
  let adminToken: string;

  const hashService = new BcryptHashService();
  const tokenService = new JwtTokenService();
  const enviarEmailMock = vi.fn().mockResolvedValue({ sucesso: true });

  beforeAll(async () => {
    repository = new InMemoryUsuarioRepository();

    const senhaHash = await hashService.hash('senha123');
    const admin: Usuario = {
      id: 'admin-1',
      nome: 'Admin',
      email: 'admin@example.com',
      senhaHash,
      papel: 'admin',
      ativo: true,
      criadoEm: new Date(),
    };
    repository.seed(admin);
    adminToken = tokenService.gerarAccessToken(admin);

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerAuthRoutes(app, {
      usuarioRepository: repository,
      hashService,
      tokenService,
      enviarEmail: enviarEmailMock,
    });
    registerUsuariosRoutes(app, { usuarioRepository: repository, hashService });
    await app.ready();
  });

  it('POST /auth/login retorna tokens com credenciais validas', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@example.com', senha: 'senha123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.usuario).toEqual({ id: 'admin-1', nome: 'Admin', papel: 'admin' });
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('POST /auth/login retorna 401 com senha invalida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@example.com', senha: 'senha-errada' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/me sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/me com token valido retorna o usuario autenticado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'admin-1', papel: 'admin' });
  });

  it('GET /usuarios com papel nao-admin retorna 200 (leitura liberada para popular selects)', async () => {
    const tecnico: Usuario = {
      id: 'tecnico-1',
      nome: 'Tecnico',
      email: 'tecnico@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
      ativo: true,
      criadoEm: new Date(),
    };
    const tecnicoToken = tokenService.gerarAccessToken(tecnico);

    const response = await app.inject({
      method: 'GET',
      url: '/usuarios',
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /usuarios sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/usuarios' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /usuarios sem papel admin retorna 403', async () => {
    const tecnico: Usuario = {
      id: 'tecnico-2',
      nome: 'Tecnico',
      email: 'tecnico2@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
      ativo: true,
      criadoEm: new Date(),
    };
    const tecnicoToken = tokenService.gerarAccessToken(tecnico);

    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: {
        nome: 'Novo',
        email: 'novo@example.com',
        senha: 'senha123',
        papel: 'atendente',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /usuarios com papel admin cria usuario sem retornar senhaHash', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Novo Usuario',
        email: 'novo@example.com',
        senha: 'senha123',
        papel: 'atendente',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).not.toHaveProperty('senhaHash');
    expect(body.email).toBe('novo@example.com');
    expect(body.telefone).toBeNull();
  });

  it('POST /usuarios com telefone informado retorna o telefone na resposta', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Usuario Com Telefone',
        email: 'com-telefone@example.com',
        senha: 'senha123',
        papel: 'atendente',
        telefone: '11999998888',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.telefone).toBe('11999998888');
  });

  it('PATCH /usuarios/:id atualiza o telefone do usuario', async () => {
    const paraAtualizar: Usuario = {
      id: '11111111-1111-1111-1111-111111111111',
      nome: 'Usuario Para Atualizar',
      email: 'atualizar-telefone@example.com',
      senhaHash: 'irrelevante',
      papel: 'atendente',
      ativo: true,
      criadoEm: new Date(),
    };
    repository.seed(paraAtualizar);

    const response = await app.inject({
      method: 'PATCH',
      url: `/usuarios/${paraAtualizar.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { telefone: '11988887777' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().telefone).toBe('11988887777');
  });

  it('POST /usuarios com papel ajudante cria usuario normalmente (mesma regra admin-only)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Novo Ajudante',
        email: 'ajudante@example.com',
        senha: 'senha123',
        papel: 'ajudante',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().papel).toBe('ajudante');
  });

  it('POST /usuarios com papel ajudante sem token admin retorna 403', async () => {
    const tecnico: Usuario = {
      id: 'tecnico-3',
      nome: 'Tecnico',
      email: 'tecnico3@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
      ativo: true,
      criadoEm: new Date(),
    };
    const tecnicoToken = tokenService.gerarAccessToken(tecnico);

    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: {
        nome: 'Ajudante Negado',
        email: 'ajudante-negado@example.com',
        senha: 'senha123',
        papel: 'ajudante',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /usuarios com valorHora informado retorna o valor na resposta', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Usuario Com ValorHora',
        email: 'com-valorhora@example.com',
        senha: 'senha123',
        papel: 'tecnico',
        valorHora: 50.5,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().valorHora).toBe(50.5);
  });

  it('POST /usuarios sem valorHora informado retorna valorHora null', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/usuarios',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Usuario Sem ValorHora',
        email: 'sem-valorhora@example.com',
        senha: 'senha123',
        papel: 'tecnico',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().valorHora).toBeNull();
  });

  it('PATCH /usuarios/:id atualiza o valorHora do usuario', async () => {
    const paraAtualizar: Usuario = {
      id: '22222222-2222-2222-2222-222222222222',
      nome: 'Usuario Para Atualizar ValorHora',
      email: 'atualizar-valorhora@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
      ativo: true,
      criadoEm: new Date(),
    };
    repository.seed(paraAtualizar);

    const response = await app.inject({
      method: 'PATCH',
      url: `/usuarios/${paraAtualizar.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { valorHora: 75 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().valorHora).toBe(75);
  });

  describe('fluxo de esqueci/redefinir senha', () => {
    it('POST /auth/esqueci-senha com e-mail existente responde 200 generico e envia e-mail com link contendo o token', async () => {
      enviarEmailMock.mockClear();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/esqueci-senha',
        payload: { email: 'admin@example.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'Se o e-mail existir em nossa base, você receberá instruções em breve.',
      });
      expect(enviarEmailMock).toHaveBeenCalledTimes(1);
      const [destinatario, , corpoTexto] = enviarEmailMock.mock.calls[0];
      expect(destinatario).toBe('admin@example.com');
      expect(corpoTexto).toContain('/redefinir-senha?token=');
    });

    it('POST /auth/esqueci-senha com e-mail inexistente responde a mesma mensagem 200 generica sem enviar e-mail', async () => {
      enviarEmailMock.mockClear();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/esqueci-senha',
        payload: { email: 'nao-cadastrado@example.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'Se o e-mail existir em nossa base, você receberá instruções em breve.',
      });
      expect(enviarEmailMock).not.toHaveBeenCalled();
    });

    it('POST /auth/redefinir-senha com token valido atualiza a senha e invalida o token (uso duplicado falha)', async () => {
      const usuario: Usuario = {
        id: 'reset-1',
        nome: 'Usuario Reset',
        email: 'reset@example.com',
        senhaHash: await hashService.hash('senha-antiga'),
        papel: 'atendente',
        ativo: true,
        criadoEm: new Date(),
      };
      repository.seed(usuario);

      enviarEmailMock.mockClear();
      await app.inject({
        method: 'POST',
        url: '/auth/esqueci-senha',
        payload: { email: 'reset@example.com' },
      });
      const [, , corpoTexto] = enviarEmailMock.mock.calls[0];
      const token = (corpoTexto as string).match(/token=([a-f0-9]+)/)?.[1] as string;

      const response = await app.inject({
        method: 'POST',
        url: '/auth/redefinir-senha',
        payload: { token, nova_senha: 'senha-nova-123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'Senha redefinida com sucesso.' });

      const loginComSenhaNova = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'reset@example.com', senha: 'senha-nova-123' },
      });
      expect(loginComSenhaNova.statusCode).toBe(200);

      // Uso duplicado do mesmo token ja usado deve falhar (token foi invalidado).
      const segundaTentativa = await app.inject({
        method: 'POST',
        url: '/auth/redefinir-senha',
        payload: { token, nova_senha: 'outra-senha-456' },
      });
      expect(segundaTentativa.statusCode).toBe(400);
    });

    it('POST /auth/redefinir-senha com token expirado retorna 400', async () => {
      const usuario: Usuario = {
        id: 'reset-2',
        nome: 'Usuario Reset Expirado',
        email: 'reset-expirado@example.com',
        senhaHash: 'irrelevante',
        papel: 'atendente',
        ativo: true,
        criadoEm: new Date(),
      };
      repository.seed(usuario);

      const tokenPlano = 'token-de-teste-expirado';
      const tokenHash = createHash('sha256').update(tokenPlano).digest('hex');
      await repository.salvarTokenReset(usuario.id, tokenHash, new Date(Date.now() - 1000));

      const response = await app.inject({
        method: 'POST',
        url: '/auth/redefinir-senha',
        payload: { token: tokenPlano, nova_senha: 'senha-nova-123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('POST /auth/redefinir-senha com token inexistente/nunca gerado retorna 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/redefinir-senha',
        payload: { token: 'token-que-nunca-existiu', nova_senha: 'senha-nova-123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('POST /auth/redefinir-senha com nova senha muito curta e rejeitado pela validacao (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/redefinir-senha',
        payload: { token: 'qualquer-token', nova_senha: '123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
