import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../../shared/http/middlewares/error-handler';

vi.mock('../../../../../shared/http/middlewares/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../shared/http/middlewares/auth')>();
  // Estes testes rodam sem Postgres (repositorios fake) e nao exercitam a
  // checagem de usuario ativo/papel-atual feita pelo `authenticate` de
  // producao (que consulta o banco) - usam a variante que so valida o JWT.
  return { ...actual, authenticate: actual.authenticateApenasToken };
});
import { JwtTokenService } from '../../../../auth/infrastructure/JwtTokenService';
import type { Usuario } from '../../../../auth/domain/Usuario';
import { registerCategoriasServicoRoutes } from '../routes';
import type { CategoriaServico } from '../../../domain/CategoriaServico';
import type {
  AtualizarCategoriaServicoDados,
  CategoriaServicoRepository,
  CriarCategoriaServicoDados,
} from '../../../domain/CategoriaServicoRepository';

/**
 * Repositorio em memoria usado apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real no
 * ambiente de CI/local. LIMITACAO: nao cobre comportamento especifico do
 * Prisma/Postgres (constraints, tipos de coluna, etc.) — isso deve ser
 * validado por um teste de integracao real contra o banco quando houver um
 * ambiente de banco disponivel.
 */
class InMemoryCategoriaServicoRepository implements CategoriaServicoRepository {
  private categorias: CategoriaServico[] = [];
  private seq = 0;

  seed(categoria: CategoriaServico): void {
    this.categorias.push(categoria);
  }

  async list(incluirInativas: boolean): Promise<CategoriaServico[]> {
    return incluirInativas ? [...this.categorias] : this.categorias.filter((c) => c.ativo);
  }

  async findById(id: string): Promise<CategoriaServico | null> {
    return this.categorias.find((c) => c.id === id) ?? null;
  }

  async create(dados: CriarCategoriaServicoDados): Promise<CategoriaServico> {
    this.seq += 1;
    const categoria: CategoriaServico = {
      id: `categoria-${this.seq}`,
      nome: dados.nome,
      area: dados.area,
      ativo: dados.ativo ?? true,
      criadoEm: new Date(),
    };
    this.categorias.push(categoria);
    return categoria;
  }

  async update(id: string, dados: AtualizarCategoriaServicoDados): Promise<CategoriaServico> {
    const categoria = this.categorias.find((c) => c.id === id);
    if (!categoria) {
      throw new Error(`categoria ${id} nao encontrada`);
    }
    Object.assign(categoria, dados);
    return categoria;
  }
}

describe('rotas de categorias-servico (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let repository: InMemoryCategoriaServicoRepository;
  let adminToken: string;
  let atendenteToken: string;

  const tokenService = new JwtTokenService();

  beforeAll(async () => {
    repository = new InMemoryCategoriaServicoRepository();
    repository.seed({
      id: '11111111-1111-1111-1111-111111111111',
      nome: 'Instalacao Eletrica',
      area: 'eletrica',
      ativo: true,
      criadoEm: new Date(),
    });
    repository.seed({
      id: '22222222-2222-2222-2222-222222222222',
      nome: 'Categoria Descontinuada',
      area: 'outro',
      ativo: false,
      criadoEm: new Date(),
    });

    const admin: Usuario = {
      id: 'admin-1',
      nome: 'Admin',
      email: 'admin@example.com',
      senhaHash: 'irrelevante',
      papel: 'admin',
      ativo: true,
      criadoEm: new Date(),
    };
    const atendente: Usuario = {
      id: 'atendente-1',
      nome: 'Atendente',
      email: 'atendente@example.com',
      senhaHash: 'irrelevante',
      papel: 'atendente',
      ativo: true,
      criadoEm: new Date(),
    };
    adminToken = tokenService.gerarAccessToken(admin);
    atendenteToken = tokenService.gerarAccessToken(atendente);

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerCategoriasServicoRoutes(app, { categoriaServicoRepository: repository });
    await app.ready();
  });

  it('GET /categorias-servico sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/categorias-servico' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /categorias-servico retorna apenas ativas para papel nao-admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/categorias-servico',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('GET /categorias-servico?incluir_inativas=true e ignorado para papel nao-admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/categorias-servico?incluir_inativas=true',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });

  it('GET /categorias-servico?incluir_inativas=true retorna todas para admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/categorias-servico?incluir_inativas=true',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('POST /categorias-servico sem papel admin retorna 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/categorias-servico',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { nome: 'Nova Categoria', area: 'automacao' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /categorias-servico com area invalida retorna 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/categorias-servico',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { nome: 'Nova Categoria', area: 'invalida' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /categorias-servico com papel admin cria categoria', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/categorias-servico',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { nome: 'Energia Solar Residencial', area: 'energia_solar' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ nome: 'Energia Solar Residencial', area: 'energia_solar', ativo: true });
  });

  it('PATCH /categorias-servico/:id inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/categorias-servico/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ativo: false },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH /categorias-servico/:id atualiza campos informados', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/categorias-servico/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ativo: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      ativo: false,
    });
  });
});
