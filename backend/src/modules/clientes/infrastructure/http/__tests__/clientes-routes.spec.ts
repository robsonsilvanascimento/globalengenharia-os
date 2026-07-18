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

import { registerClientesRoutes } from '../routes';
import { JwtTokenService } from '../../../../auth/infrastructure/JwtTokenService';
import type { Usuario } from '../../../../auth/domain/Usuario';
import type { Cliente } from '../../../domain/Cliente';
import type { ClienteRepository, CriarClienteDados } from '../../../domain/ClienteRepository';
import type { CategoriaServico } from '../../../../categorias-servico/domain/CategoriaServico';
import type { CategoriaServicoRepository } from '../../../../categorias-servico/domain/CategoriaServicoRepository';
import {
  FakeOrdemServicoRepository,
  criarOrdemServicoFake,
} from '../../../../ordens-servico/application/__tests__/fakes';

/**
 * Repositorio em memoria usado apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real no
 * ambiente de CI/local. LIMITACAO: nao cobre comportamento especifico do
 * Prisma/Postgres (constraint unique de telefone, tipos de coluna, etc.) —
 * isso deve ser validado por um teste de integracao real contra o banco
 * quando houver um ambiente de banco disponivel.
 */
class InMemoryClienteRepository implements ClienteRepository {
  private clientes: Cliente[] = [];
  private seq = 0;

  seed(cliente: Cliente): void {
    this.clientes.push(cliente);
  }

  async list(): Promise<Cliente[]> {
    return [...this.clientes];
  }

  async findById(id: string): Promise<Cliente | null> {
    return this.clientes.find((c) => c.id === id) ?? null;
  }

  async findByTelefone(telefone: string): Promise<Cliente | null> {
    return this.clientes.find((c) => c.telefoneWhatsapp === telefone) ?? null;
  }

  async create(dados: CriarClienteDados): Promise<Cliente> {
    this.seq += 1;
    const cliente: Cliente = {
      id: `cliente-${this.seq}`,
      nome: dados.nome,
      telefoneWhatsapp: dados.telefoneWhatsapp,
      documento: dados.documento ?? null,
      email: dados.email ?? null,
      criadoEm: new Date(),
    };
    this.clientes.push(cliente);
    return cliente;
  }

  async update(id: string, dados: Partial<{ nome: string; email: string }>): Promise<Cliente> {
    const cliente = this.clientes.find((c) => c.id === id);
    if (!cliente) {
      throw new Error(`Cliente ${id} nao encontrado`);
    }
    if (dados.nome !== undefined) cliente.nome = dados.nome;
    if (dados.email !== undefined) cliente.email = dados.email;
    return cliente;
  }
}

/** Fake minimo de CategoriaServicoRepository, usado apenas para enriquecer categoria_nome no resumo. */
class FakeCategoriaServicoRepository implements CategoriaServicoRepository {
  constructor(private readonly categorias: CategoriaServico[]) {}

  async list(): Promise<CategoriaServico[]> {
    return this.categorias;
  }

  async findById(id: string): Promise<CategoriaServico | null> {
    return this.categorias.find((c) => c.id === id) ?? null;
  }

  async create(): Promise<CategoriaServico> {
    throw new Error('nao usado neste teste');
  }

  async update(): Promise<CategoriaServico> {
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

const CLIENTE_COM_OS_ID = '11111111-1111-1111-1111-111111111111';
const CLIENTE_SEM_OS_ID = '22222222-2222-2222-2222-222222222222';
const CLIENTE_INEXISTENTE_ID = '99999999-9999-9999-9999-999999999999';

describe('rotas de clientes (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let repository: InMemoryClienteRepository;
  let ordemServicoRepository: FakeOrdemServicoRepository;
  const tokenService = new JwtTokenService();
  let atendenteToken: string;
  let tecnicoToken: string;

  beforeAll(async () => {
    repository = new InMemoryClienteRepository();
    repository.seed({
      id: 'cliente-seed-1',
      nome: 'Joao da Silva',
      telefoneWhatsapp: '5511999990000',
      documento: null,
      criadoEm: new Date(),
    });
    repository.seed({
      id: CLIENTE_COM_OS_ID,
      nome: 'Maria com Historico',
      telefoneWhatsapp: '5511922223333',
      documento: '12345678900',
      email: 'maria@example.com',
      criadoEm: new Date(),
    });
    repository.seed({
      id: CLIENTE_SEM_OS_ID,
      nome: 'Cliente Sem Historico',
      telefoneWhatsapp: '5511944445555',
      documento: null,
      criadoEm: new Date(),
    });

    const categoriaServicoRepository = new FakeCategoriaServicoRepository([
      {
        id: 'categoria-1',
        nome: 'Instalacao Eletrica',
        area: 'eletrica',
        ativo: true,
        criadoEm: new Date(),
      },
    ]);

    ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-1',
        numero: 'OS-2026-000001',
        clienteId: CLIENTE_COM_OS_ID,
        categoriaServicoId: 'categoria-1',
        descricaoProblema: 'Tomada nao funciona',
        status: 'concluida',
        valorCobrado: 150,
        criadoEm: new Date('2026-01-10T10:00:00Z'),
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-2',
        numero: 'OS-2026-000002',
        clienteId: CLIENTE_COM_OS_ID,
        categoriaServicoId: 'categoria-1',
        descricaoProblema: 'Orcamento sem valor definido ainda',
        status: 'aberta',
        valorCobrado: undefined,
        criadoEm: new Date('2026-02-15T10:00:00Z'),
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-3',
        numero: 'OS-2026-000003',
        clienteId: CLIENTE_COM_OS_ID,
        categoriaServicoId: 'categoria-1',
        descricaoProblema: 'Troca de disjuntor',
        status: 'concluida',
        valorCobrado: 300.5,
        criadoEm: new Date('2026-03-01T10:00:00Z'),
      }),
    );

    atendenteToken = tokenService.gerarAccessToken(criarUsuarioFake({ papel: 'atendente' }));
    tecnicoToken = tokenService.gerarAccessToken(
      criarUsuarioFake({ id: 'user-2', papel: 'tecnico' }),
    );

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerClientesRoutes(app, {
      clienteRepository: repository,
      ordemServicoRepository,
      categoriaServicoRepository,
    });
    await app.ready();
  });

  it('GET /clientes sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/clientes' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /clientes com token de atendente lista clientes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(3);
  });

  it('GET /clientes com token de tecnico retorna 403 (lista completa de clientes nao e visivel para tecnico)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/clientes',
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /clientes?q= filtra por nome ou telefone', async () => {
    const porNome = await app.inject({
      method: 'GET',
      url: '/clientes?q=joao',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });
    expect(porNome.json()).toHaveLength(1);

    const semResultado = await app.inject({
      method: 'GET',
      url: '/clientes?q=inexistente',
      headers: { authorization: `Bearer ${atendenteToken}` },
    });
    expect(semResultado.json()).toHaveLength(0);
  });

  it('POST /clientes sem papel atendente/admin retorna 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: { nome: 'Novo Cliente', telefone_whatsapp: '5511988887777' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /clientes com papel atendente cria cliente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { nome: 'Novo Cliente', telefone_whatsapp: '5511988887777' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ nome: 'Novo Cliente', telefoneWhatsapp: '5511988887777' });
  });

  it('POST /clientes com telefone ja cadastrado retorna 409', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { nome: 'Duplicado', telefone_whatsapp: '5511999990000' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('POST /clientes sem nome retorna erro de validacao (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: { telefone_whatsapp: '5511977776666' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /clientes com email valido cria cliente com email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        nome: 'Cliente Com Email',
        telefone_whatsapp: '5511911112222',
        email: 'cliente@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ nome: 'Cliente Com Email', email: 'cliente@example.com' });
  });

  it('POST /clientes com email em formato invalido retorna erro de validacao (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { authorization: `Bearer ${atendenteToken}` },
      payload: {
        nome: 'Cliente Email Invalido',
        telefone_whatsapp: '5511933334444',
        email: 'nao-e-um-email',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('ClienteRepository.update atualiza nome e email do cliente', async () => {
    const criado = await repository.create({
      nome: 'Nome Provisorio',
      telefoneWhatsapp: '5511955556666',
    });

    const atualizado = await repository.update(criado.id, {
      nome: 'Nome Definitivo',
      email: 'definitivo@example.com',
    });

    expect(atualizado).toMatchObject({
      id: criado.id,
      nome: 'Nome Definitivo',
      email: 'definitivo@example.com',
    });
  });

  it('GET /clientes/:id sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: `/clientes/${CLIENTE_COM_OS_ID}` });
    expect(response.statusCode).toBe(401);
  });

  it('GET /clientes/:id existente retorna dados cadastrais para atendente/admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_COM_OS_ID}`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: CLIENTE_COM_OS_ID,
      nome: 'Maria com Historico',
      telefone_whatsapp: '5511922223333',
      email: 'maria@example.com',
      documento: '12345678900',
    });
  });

  it('GET /clientes/:id com token de tecnico retorna 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_COM_OS_ID}`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /clientes/:id inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_INEXISTENTE_ID}`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /clientes/:id/resumo com multiplas OS soma valor cobrado e lista historico mais recente primeiro', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_COM_OS_ID}/resumo`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.total_ordens_servico).toBe(3);
    expect(body.total_valor_cobrado).toBe(450.5);
    expect(body.ordens_servico).toHaveLength(3);
    expect(body.ordens_servico.map((os: { id: string }) => os.id)).toEqual(['os-3', 'os-2', 'os-1']);

    const osSemValor = body.ordens_servico.find((os: { id: string }) => os.id === 'os-2');
    expect(osSemValor.valor_cobrado).toBeNull();
    expect(osSemValor.categoria_nome).toBe('Instalacao Eletrica');

    const osComValor = body.ordens_servico.find((os: { id: string }) => os.id === 'os-3');
    expect(osComValor.valor_cobrado).toBe(300.5);
  });

  it('GET /clientes/:id/resumo de cliente sem nenhuma OS retorna zeros e lista vazia', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_SEM_OS_ID}/resumo`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      total_ordens_servico: 0,
      total_valor_cobrado: 0,
      ordens_servico: [],
    });
  });

  it('GET /clientes/:id/resumo de cliente inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/clientes/${CLIENTE_INEXISTENTE_ID}/resumo`,
      headers: { authorization: `Bearer ${atendenteToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
