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
import { EventBus } from '../../../../../shared/domain/EventBus';
import { JwtTokenService } from '../../../../auth/infrastructure/JwtTokenService';
import type { Usuario } from '../../../../auth/domain/Usuario';
import type { UsuarioRepository } from '../../../../auth/domain/UsuarioRepository';
import type { Cliente } from '../../../../clientes/domain/Cliente';
import type { ClienteRepository } from '../../../../clientes/domain/ClienteRepository';
import { registerOrdensServicoRoutes } from '../routes';
import {
  FakeHistoricoStatusOSRepository,
  FakeNumeroOSGenerator,
  FakeOrdemServicoRepository,
  criarOrdemServicoFake,
} from '../../../application/__tests__/fakes';

/**
 * Repositorios em memoria minimos apenas para satisfazer as dependencias de
 * enriquecimento do DTO (cliente_nome/tecnico_nome) neste teste de rotas.
 */
class InMemoryClienteRepository implements ClienteRepository {
  constructor(private readonly clientes: Cliente[]) {}
  async list() {
    return this.clientes;
  }
  async findById(id: string) {
    return this.clientes.find((c) => c.id === id) ?? null;
  }
  async findByTelefone() {
    return null;
  }
  async create(): Promise<Cliente> {
    throw new Error('nao usado neste teste');
  }
}

class InMemoryUsuarioRepository implements UsuarioRepository {
  constructor(private readonly usuarios: Usuario[]) {}
  async findByEmail() {
    return null;
  }
  async findById(id: string) {
    return this.usuarios.find((u) => u.id === id) ?? null;
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

describe('rotas de ordens-servico (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let ordemServicoRepository: FakeOrdemServicoRepository;
  const tokenService = new JwtTokenService();
  let atendenteToken: string;
  let tecnicoToken: string;
  let adminToken: string;

  const OS_ID = '10000000-0000-0000-0000-000000000001';
  const OS_ID_TECNICO_OCUPADO = '10000000-0000-0000-0000-000000000002';
  const OS_ID_AJUDANTE_SUCESSO = '10000000-0000-0000-0000-000000000003';
  const OS_ID_AJUDANTE_OCUPADO = '10000000-0000-0000-0000-000000000004';
  const OS_ID_DISPONIBILIDADE_COM_DATA = '10000000-0000-0000-0000-000000000005';
  const OS_ID_DISPONIBILIDADE_SEM_DATA = '10000000-0000-0000-0000-000000000006';
  const OS_ID_INEXISTENTE = '40000000-0000-0000-0000-000000000099';
  const CLIENTE_ID = '20000000-0000-0000-0000-000000000001';
  const CATEGORIA_ID = '11111111-1111-1111-1111-111111111111';
  const TECNICO_ID = '30000000-0000-0000-0000-000000000001';
  const TECNICO_ID_2 = '30000000-0000-0000-0000-000000000002';
  const AJUDANTE_ID = '30000000-0000-0000-0000-000000000003';

  const DATA_TECNICO_2_OCUPADO = new Date('2026-09-01T10:00:00.000Z');
  const DATA_AJUDANTE_OCUPADO = new Date('2026-09-02T10:00:00.000Z');
  const DATA_DISPONIBILIDADE = new Date('2026-09-03T10:00:00.000Z');

  beforeAll(async () => {
    ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_ID, clienteId: CLIENTE_ID, status: 'aberta' }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_ID_TECNICO_OCUPADO, clienteId: CLIENTE_ID, status: 'aberta' }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_ID_AJUDANTE_SUCESSO, clienteId: CLIENTE_ID, status: 'aberta' }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_ID_AJUDANTE_OCUPADO, clienteId: CLIENTE_ID, status: 'aberta' }),
    );
    // OS "de referencia" ja ocupando tecnico-2 e ajudante no mesmo horario, usada
    // para os testes de conflito (409) e para o endpoint de disponibilidade.
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-conflito-tecnico-2',
        clienteId: CLIENTE_ID,
        status: 'atribuida',
        tecnicoId: TECNICO_ID_2,
        dataAgendada: DATA_TECNICO_2_OCUPADO,
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-conflito-ajudante',
        clienteId: CLIENTE_ID,
        status: 'atribuida',
        ajudanteId: AJUDANTE_ID,
        dataAgendada: DATA_AJUDANTE_OCUPADO,
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: OS_ID_DISPONIBILIDADE_COM_DATA,
        clienteId: CLIENTE_ID,
        status: 'atribuida',
        tecnicoId: TECNICO_ID_2,
        ajudanteId: AJUDANTE_ID,
        dataAgendada: DATA_DISPONIBILIDADE,
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: OS_ID_DISPONIBILIDADE_SEM_DATA,
        clienteId: CLIENTE_ID,
        status: 'aberta',
      }),
    );

    const cliente: Cliente = {
      id: CLIENTE_ID,
      nome: 'Joao da Silva',
      telefoneWhatsapp: '5511999990000',
      documento: null,
      criadoEm: new Date(),
    };
    const tecnico = criarUsuarioFake({ id: TECNICO_ID, nome: 'Tecnico Um', papel: 'tecnico' });
    const tecnico2 = criarUsuarioFake({ id: TECNICO_ID_2, nome: 'Tecnico Dois', papel: 'tecnico' });
    const ajudante = criarUsuarioFake({ id: AJUDANTE_ID, nome: 'Ajudante Um', papel: 'ajudante' });

    atendenteToken = tokenService.gerarAccessToken(criarUsuarioFake({ papel: 'atendente' }));
    tecnicoToken = tokenService.gerarAccessToken(
      criarUsuarioFake({ id: 'user-2', papel: 'tecnico' }),
    );
    adminToken = tokenService.gerarAccessToken(
      criarUsuarioFake({ id: 'user-3', papel: 'admin' }),
    );

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerOrdensServicoRoutes(app, {
      ordemServicoRepository,
      historicoStatusOSRepository: new FakeHistoricoStatusOSRepository(),
      numeroOSGenerator: new FakeNumeroOSGenerator(),
      eventBus: new EventBus(),
      clienteRepository: new InMemoryClienteRepository([cliente]),
      usuarioRepository: new InMemoryUsuarioRepository([tecnico, tecnico2, ajudante]),
    });
    await app.ready();
  });

  it('GET /ordens-servico sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/ordens-servico' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /ordens-servico com token valido retorna lista paginada', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ordens-servico',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // Nao assume um total fixo: outros testes deste arquivo seedam OS
    // adicionais no `beforeAll` compartilhado (ex.: cenarios de
    // disponibilidade de tecnico/ajudante), entao o total cresce conforme
    // novos casos sao adicionados. Verificamos apenas a forma da paginacao
    // e que a OS conhecida (OS_ID) esta presente na listagem.
    expect(body).toMatchObject({ page: 1, page_size: 20 });
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.data).toContainEqual(
      expect.objectContaining({ id: OS_ID, cliente_nome: 'Joao da Silva' }),
    );
  });

  it('POST /ordens-servico sem papel atendente/admin retorna 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/ordens-servico',
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: {
        cliente_id: CLIENTE_ID,
        categoria_servico_id: CATEGORIA_ID,
        descricao_problema: 'Problema',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /ordens-servico com papel atendente cria a OS', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/ordens-servico',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        cliente_id: CLIENTE_ID,
        categoria_servico_id: CATEGORIA_ID,
        descricao_problema: 'Disjuntor desarmando',
        prioridade: 'alta',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ status: 'aberta', descricao_problema: 'Disjuntor desarmando' });
    expect(body.numero).toMatch(/^\d{4}\d{2}\d{2,}$/);
  });

  it('GET /ordens-servico/:id inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID_INEXISTENTE}`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH /ordens-servico/:id/status com transicao invalida retorna 409', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/status`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { status: 'atribuida' }, // pula etapa (aberta -> atribuida)
    });

    expect(response.statusCode).toBe(409);
  });

  it('PATCH /ordens-servico/:id/status com transicao valida atualiza o status', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/status`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { status: 'triagem' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'triagem' });
  });

  it('PATCH /ordens-servico/:id/atribuir atribui tecnico, agenda data e muda status para atribuida', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/atribuir`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { tecnico_id: TECNICO_ID, data_agendada: '2026-08-01T10:00:00.000Z' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'atribuida',
      tecnico_id: TECNICO_ID,
      tecnico_nome: 'Tecnico Um',
      data_agendada: '2026-08-01T10:00:00.000Z',
    });
  });

  it('GET /ordens-servico/:id/historico retorna array de historico', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID}/historico`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('PATCH /ordens-servico/:id/valor sem papel admin retorna 403 (atendente)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/valor`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { valor_cobrado: 100 },
    });

    expect(response.statusCode).toBe(403);
  });

  it('PATCH /ordens-servico/:id/valor sem papel admin retorna 403 (tecnico)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/valor`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: { valor_cobrado: 100 },
    });

    expect(response.statusCode).toBe(403);
  });

  it('PATCH /ordens-servico/:id/valor com valor negativo retorna 400', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/valor`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { valor_cobrado: -10 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('PATCH /ordens-servico/:id/valor com OS inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID_INEXISTENTE}/valor`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { valor_cobrado: 100 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH /ordens-servico/:id/valor com papel admin registra o valor cobrado', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID}/valor`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { valor_cobrado: 249.9 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: OS_ID, valor_cobrado: 249.9 });
  });

  it('GET /ordens-servico/:id reflete o valor_cobrado registrado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID}`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ valor_cobrado: 249.9 });
  });

  it('GET /ordens-servico lista reflete o valor_cobrado registrado (ou null quando ausente)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ordens-servico',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const osAlvo = body.data.find((item: { id: string }) => item.id === OS_ID);
    expect(osAlvo).toMatchObject({ valor_cobrado: 249.9 });
  });

  it('PATCH /ordens-servico/:id/atribuir com tecnico ocupado no mesmo horario retorna 409', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID_TECNICO_OCUPADO}/atribuir`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        tecnico_id: TECNICO_ID_2,
        data_agendada: DATA_TECNICO_2_OCUPADO.toISOString(),
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('PATCH /ordens-servico/:id/atribuir com ajudante ocupado no mesmo horario retorna 409', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID_AJUDANTE_OCUPADO}/atribuir`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        tecnico_id: TECNICO_ID,
        ajudante_id: AJUDANTE_ID,
        data_agendada: DATA_AJUDANTE_OCUPADO.toISOString(),
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('PATCH /ordens-servico/:id/atribuir com tecnico e ajudante disponiveis funciona', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/ordens-servico/${OS_ID_AJUDANTE_SUCESSO}/atribuir`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        tecnico_id: TECNICO_ID,
        ajudante_id: AJUDANTE_ID,
        data_agendada: '2026-09-04T10:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'atribuida', tecnico_id: TECNICO_ID });
  });

  it('GET /ordens-servico/:id/disponibilidade com dataAgendada retorna listas filtrando quem esta ocupado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID_DISPONIBILIDADE_COM_DATA}/disponibilidade`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sem_data_agendada).toBeUndefined();
    expect(body.tecnicos_disponiveis.map((t: { id: string }) => t.id)).toEqual([TECNICO_ID]);
    expect(body.ajudantes_disponiveis).toEqual([]);
  });

  it('GET /ordens-servico/:id/disponibilidade sem dataAgendada retorna todos os ativos com flag sem_data_agendada', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID_DISPONIBILIDADE_SEM_DATA}/disponibilidade`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sem_data_agendada).toBe(true);
    expect(body.tecnicos_disponiveis.map((t: { id: string }) => t.id).sort()).toEqual(
      [TECNICO_ID, TECNICO_ID_2].sort(),
    );
    expect(body.ajudantes_disponiveis.map((a: { id: string }) => a.id)).toEqual([AJUDANTE_ID]);
  });

  it('GET /ordens-servico/:id/disponibilidade com OS inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID_INEXISTENTE}/disponibilidade`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /ordens-servico/:id/disponibilidade sem papel atendente/admin retorna 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_ID_DISPONIBILIDADE_SEM_DATA}/disponibilidade`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
