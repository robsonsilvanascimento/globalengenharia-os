import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../../shared/http/middlewares/error-handler';
import { JwtTokenService } from '../../../../auth/infrastructure/JwtTokenService';
import type { Usuario } from '../../../../auth/domain/Usuario';
import { registerFaqRoutes } from '../routes';
import type { FaqEntry } from '../../../domain/FaqEntry';
import type {
  AtualizarFaqEntryDados,
  CriarFaqEntryDados,
  FaqEntryRepository,
} from '../../../domain/FaqEntryRepository';

/**
 * Repositorio em memoria usado apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real no
 * ambiente de CI/local. LIMITACAO: nao cobre comportamento especifico do
 * Prisma/Postgres (constraints, tipos de coluna, etc.) — isso deve ser
 * validado por um teste de integracao real contra o banco quando houver um
 * ambiente de banco disponivel.
 */
class InMemoryFaqEntryRepository implements FaqEntryRepository {
  private entradas: FaqEntry[] = [];
  private seq = 0;

  seed(entrada: FaqEntry): void {
    this.entradas.push(entrada);
  }

  async list(incluirInativas: boolean): Promise<FaqEntry[]> {
    return incluirInativas ? [...this.entradas] : this.entradas.filter((e) => e.ativo);
  }

  async findById(id: string): Promise<FaqEntry | null> {
    return this.entradas.find((e) => e.id === id) ?? null;
  }

  async create(dados: CriarFaqEntryDados): Promise<FaqEntry> {
    this.seq += 1;
    const entrada: FaqEntry = {
      id: `faq-${this.seq}`,
      pergunta: dados.pergunta,
      resposta: dados.resposta,
      tags: dados.tags ?? null,
      ativo: dados.ativo ?? true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.entradas.push(entrada);
    return entrada;
  }

  async update(id: string, dados: AtualizarFaqEntryDados): Promise<FaqEntry> {
    const entrada = this.entradas.find((e) => e.id === id);
    if (!entrada) {
      throw new Error(`faq entry ${id} nao encontrada`);
    }
    Object.assign(entrada, dados, { atualizadoEm: new Date() });
    return entrada;
  }
}

describe('rotas de faq (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let repository: InMemoryFaqEntryRepository;
  let adminToken: string;
  let atendenteToken: string;

  const tokenService = new JwtTokenService();

  beforeAll(async () => {
    repository = new InMemoryFaqEntryRepository();
    repository.seed({
      id: '11111111-1111-1111-1111-111111111111',
      pergunta: 'Qual o horario de atendimento?',
      resposta: 'Atendemos de segunda a sexta, das 8h as 18h.',
      tags: 'horario',
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    repository.seed({
      id: '22222222-2222-2222-2222-222222222222',
      pergunta: 'Pergunta descontinuada',
      resposta: 'Resposta descontinuada',
      tags: null,
      ativo: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
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
    registerFaqRoutes(app, { faqEntryRepository: repository });
    await app.ready();
  });

  it('GET /faq sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/faq' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /faq retorna apenas ativas para papel nao-admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/faq',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('GET /faq?incluir_inativas=true e ignorado para papel nao-admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/faq?incluir_inativas=true',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });

  it('GET /faq?incluir_inativas=true retorna todas para admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/faq?incluir_inativas=true',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('POST /faq sem papel admin retorna 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/faq',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { pergunta: 'Nova pergunta?', resposta: 'Nova resposta.' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /faq sem pergunta/resposta retorna 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/faq',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { pergunta: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /faq com papel admin cria entrada', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/faq',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { pergunta: 'Voces atendem aos sabados?', resposta: 'Nao, so de segunda a sexta.' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      pergunta: 'Voces atendem aos sabados?',
      resposta: 'Nao, so de segunda a sexta.',
      ativo: true,
    });
  });

  it('PATCH /faq/:id inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/faq/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ativo: false },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH /faq/:id sem papel admin retorna 403', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/faq/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { ativo: false },
    });

    expect(response.statusCode).toBe(403);
  });

  it('PATCH /faq/:id atualiza campos informados', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/faq/11111111-1111-1111-1111-111111111111',
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
