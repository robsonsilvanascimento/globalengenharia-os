import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { Cliente } from '../../../../clientes/domain/Cliente';
import type { ClienteRepository, CriarClienteDados } from '../../../../clientes/domain/ClienteRepository';
import {
  FakeCriarFaqEntry,
  FakeSolicitacaoAtendimentoRepository,
  criarSolicitacaoAtendimentoFake,
} from '../../../application/__tests__/fakes';

const { enviarTextoMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn(),
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarTexto: enviarTextoMock,
}));

import { registerAtendimentoHumanoRoutes } from '../routes';

const SOLICITACAO_PENDENTE_ID = '11111111-1111-1111-1111-111111111111';
const SOLICITACAO_RESPONDIDA_ID = '22222222-2222-2222-2222-222222222222';

/** Fake de ClienteRepository usado apenas nestes testes de integracao leves das rotas HTTP. */
class FakeClienteRepository implements ClienteRepository {
  constructor(private clientes: Cliente[] = []) {}

  async list(): Promise<Cliente[]> {
    return this.clientes;
  }

  async findById(id: string): Promise<Cliente | null> {
    return this.clientes.find((cliente) => cliente.id === id) ?? null;
  }

  async findByTelefone(telefone: string): Promise<Cliente | null> {
    return this.clientes.find((cliente) => cliente.telefoneWhatsapp === telefone) ?? null;
  }

  async create(dados: CriarClienteDados): Promise<Cliente> {
    const cliente: Cliente = {
      id: `cliente-${this.clientes.length + 1}`,
      nome: dados.nome,
      telefoneWhatsapp: dados.telefoneWhatsapp,
      documento: dados.documento,
      email: dados.email,
      criadoEm: new Date(),
    };
    this.clientes.push(cliente);
    return cliente;
  }

  async update(id: string, dados: Partial<{ nome: string; email: string }>): Promise<Cliente> {
    const cliente = this.clientes.find((c) => c.id === id);
    if (!cliente) throw new Error('nao encontrado');
    Object.assign(cliente, dados);
    return cliente;
  }
}

describe('rotas de atendimento-humano (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let solicitacaoAtendimentoRepository: FakeSolicitacaoAtendimentoRepository;
  let criarFaqEntry: FakeCriarFaqEntry;
  let adminToken: string;
  let atendenteToken: string;
  let tecnicoToken: string;

  const tokenService = new JwtTokenService();
  const clienteFake: Cliente = {
    id: 'cliente-1',
    nome: 'Cliente Teste',
    telefoneWhatsapp: '5511999999999',
    criadoEm: new Date(),
  };

  beforeAll(async () => {
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
    const tecnico: Usuario = {
      id: 'tecnico-1',
      nome: 'Tecnico',
      email: 'tecnico@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
      ativo: true,
      criadoEm: new Date(),
    };
    adminToken = tokenService.gerarAccessToken(admin);
    atendenteToken = tokenService.gerarAccessToken(atendente);
    tecnicoToken = tokenService.gerarAccessToken(tecnico);
  });

  beforeEach(async () => {
    enviarTextoMock.mockReset();
    enviarTextoMock.mockResolvedValue({ sucesso: true, messageId: 'msg-1' });

    solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({
        id: SOLICITACAO_PENDENTE_ID,
        clienteId: 'cliente-1',
        mensagemCliente: 'Voces atendem aos sabados?',
        status: 'pendente',
      }),
    );
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({
        id: SOLICITACAO_RESPONDIDA_ID,
        clienteId: 'cliente-1',
        status: 'respondida',
      }),
    );
    criarFaqEntry = new FakeCriarFaqEntry();

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerAtendimentoHumanoRoutes(app, {
      solicitacaoAtendimentoRepository,
      clienteRepository: new FakeClienteRepository([clienteFake]),
      criarFaqEntry,
    });
    await app.ready();
  });

  it('GET /solicitacoes-atendimento sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/solicitacoes-atendimento' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /solicitacoes-atendimento com papel nao autorizado retorna 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/solicitacoes-atendimento',
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /solicitacoes-atendimento retorna somente pendentes por padrao', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/solicitacoes-atendimento',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(SOLICITACAO_PENDENTE_ID);
  });

  it('GET /solicitacoes-atendimento?status=respondida filtra pelo status informado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/solicitacoes-atendimento?status=respondida',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(SOLICITACAO_RESPONDIDA_ID);
  });

  it('PATCH /solicitacoes-atendimento/:id/responder sem token retorna 401', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/solicitacoes-atendimento/${SOLICITACAO_PENDENTE_ID}/responder`,
      payload: { resposta_texto: 'Resposta' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PATCH /solicitacoes-atendimento/:id/responder com papel nao autorizado retorna 403', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/solicitacoes-atendimento/${SOLICITACAO_PENDENTE_ID}/responder`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: { resposta_texto: 'Resposta' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('PATCH /solicitacoes-atendimento/:id/responder com corpo invalido retorna 400', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/solicitacoes-atendimento/${SOLICITACAO_PENDENTE_ID}/responder`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('PATCH /solicitacoes-atendimento/:id/responder inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/solicitacoes-atendimento/00000000-0000-0000-0000-000000000000/responder',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { resposta_texto: 'Resposta' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('PATCH /solicitacoes-atendimento/:id/responder sem salvar_como_faq responde e nao cria FaqEntry', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/solicitacoes-atendimento/${SOLICITACAO_PENDENTE_ID}/responder`,
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { resposta_texto: 'Sim, aos sabados das 8h as 12h.' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('respondida');
    expect(body.resposta_texto).toBe('Sim, aos sabados das 8h as 12h.');
    expect(criarFaqEntry.criadas).toHaveLength(0);
    expect(enviarTextoMock).toHaveBeenCalledWith('5511999999999', 'Sim, aos sabados das 8h as 12h.');
  });

  it('PATCH /solicitacoes-atendimento/:id/responder com salvar_como_faq=true cria a FaqEntry', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/solicitacoes-atendimento/${SOLICITACAO_PENDENTE_ID}/responder`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { resposta_texto: 'Sim, aos sabados das 8h as 12h.', salvar_como_faq: true },
    });

    expect(response.statusCode).toBe(200);
    expect(criarFaqEntry.criadas).toEqual([
      { pergunta: 'Voces atendem aos sabados?', resposta: 'Sim, aos sabados das 8h as 12h.' },
    ]);
  });
});
