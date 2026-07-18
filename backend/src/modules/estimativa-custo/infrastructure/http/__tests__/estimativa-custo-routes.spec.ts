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
import type { AtualizarUsuarioDados, UsuarioRepository } from '../../../../auth/domain/UsuarioRepository';
import type { OrdemServico } from '../../../../ordens-servico/domain/OrdemServico';
import type {
  AtualizarOrdemServicoDados,
  ListarOrdensServicoResultado,
  OrdemServicoRepository,
} from '../../../../ordens-servico/domain/OrdemServicoRepository';
import { registerEstimativaCustoRoutes } from '../routes';
import type { EstimativaCustoOS } from '../../../domain/EstimativaCustoOS';
import type {
  EstimativaCustoOSRepository,
  UpsertEstimativaCustoOSDados,
} from '../../../domain/EstimativaCustoOSRepository';

/**
 * Repositorios em memoria usados apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real no
 * ambiente de CI/local. LIMITACAO: nao cobrem comportamento especifico do
 * Prisma/Postgres — isso deve ser validado por um teste de integracao real
 * contra o banco quando houver um ambiente de banco disponivel.
 */
class InMemoryEstimativaCustoOSRepository implements EstimativaCustoOSRepository {
  private estimativas: EstimativaCustoOS[] = [];
  private seq = 0;

  async findByOrdemServicoId(ordemServicoId: string): Promise<EstimativaCustoOS | null> {
    return this.estimativas.find((e) => e.ordemServicoId === ordemServicoId) ?? null;
  }

  async upsert(ordemServicoId: string, dados: UpsertEstimativaCustoOSDados): Promise<EstimativaCustoOS> {
    const existente = this.estimativas.find((e) => e.ordemServicoId === ordemServicoId);
    if (existente) {
      Object.assign(existente, dados, { atualizadoEm: new Date() });
      return existente;
    }
    this.seq += 1;
    const nova: EstimativaCustoOS = {
      id: `estimativa-${this.seq}`,
      ordemServicoId,
      ...dados,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.estimativas.push(nova);
    return nova;
  }
}

class InMemoryOrdemServicoRepository implements OrdemServicoRepository {
  private ordens: OrdemServico[] = [];

  seed(ordemServico: OrdemServico): void {
    this.ordens.push(ordemServico);
  }

  async create(): Promise<OrdemServico> {
    throw new Error('nao implementado neste fake');
  }

  async findById(id: string): Promise<OrdemServico | null> {
    return this.ordens.find((o) => o.id === id) ?? null;
  }

  async findByNumero(): Promise<OrdemServico | null> {
    throw new Error('nao implementado neste fake');
  }

  async update(id: string, dados: AtualizarOrdemServicoDados): Promise<OrdemServico> {
    const ordemServico = this.ordens.find((o) => o.id === id);
    if (!ordemServico) {
      throw new Error(`OS ${id} nao encontrada`);
    }
    Object.assign(ordemServico, dados);
    return ordemServico;
  }

  async list(): Promise<ListarOrdensServicoResultado> {
    return { itens: this.ordens, total: this.ordens.length };
  }

  async buscarConflitosDeHorario(): Promise<OrdemServico[]> {
    return [];
  }
}

class InMemoryUsuarioRepository implements UsuarioRepository {
  private usuarios: Usuario[] = [];

  seed(usuario: Usuario): void {
    this.usuarios.push(usuario);
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }

  async create(): Promise<Usuario> {
    throw new Error('nao implementado neste fake');
  }

  async list(): Promise<Usuario[]> {
    return this.usuarios;
  }

  async update(id: string, dados: AtualizarUsuarioDados): Promise<Usuario> {
    const usuario = this.usuarios.find((u) => u.id === id);
    if (!usuario) {
      throw new Error(`usuario ${id} nao encontrado`);
    }
    Object.assign(usuario, dados);
    return usuario;
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

const OS_COM_TECNICO_ID = '11111111-1111-1111-1111-111111111111';
const OS_COM_AJUDANTE_ID = '22222222-2222-2222-2222-222222222222';
const OS_SEM_TECNICO_ID = '33333333-3333-3333-3333-333333333333';
const OS_TECNICO_SEM_VALOR_HORA_ID = '44444444-4444-4444-4444-444444444444';
const OS_INEXISTENTE_ID = '99999999-9999-9999-9999-999999999999';

function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  return {
    id: 'os-1',
    numero: 'OS-2026-000001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema eletrico',
    prioridade: 'normal',
    status: 'atribuida',
    criadoVia: 'painel',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-1',
    nome: 'Tecnico',
    email: 'tecnico@example.com',
    senhaHash: 'irrelevante',
    papel: 'tecnico',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

describe('rotas de estimativa-custo (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let ordemServicoRepository: InMemoryOrdemServicoRepository;
  let usuarioRepository: InMemoryUsuarioRepository;
  let adminToken: string;
  let tecnicoToken: string;

  const tokenService = new JwtTokenService();

  beforeAll(async () => {
    ordemServicoRepository = new InMemoryOrdemServicoRepository();
    usuarioRepository = new InMemoryUsuarioRepository();

    const tecnicoComValorHora = criarUsuarioFake({ id: 'tecnico-1', valorHora: 50 });
    const tecnicoSemValorHora = criarUsuarioFake({ id: 'tecnico-2', email: 'tecnico2@example.com', valorHora: null });
    const ajudanteComValorHora = criarUsuarioFake({
      id: 'ajudante-1',
      email: 'ajudante@example.com',
      papel: 'ajudante',
      valorHora: 25,
    });
    usuarioRepository.seed(tecnicoComValorHora);
    usuarioRepository.seed(tecnicoSemValorHora);
    usuarioRepository.seed(ajudanteComValorHora);

    ordemServicoRepository.seed(criarOrdemServicoFake({ id: OS_COM_TECNICO_ID, tecnicoId: 'tecnico-1' }));
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_COM_AJUDANTE_ID, tecnicoId: 'tecnico-1', ajudanteId: 'ajudante-1' }),
    );
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: OS_SEM_TECNICO_ID, tecnicoId: undefined }));
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: OS_TECNICO_SEM_VALOR_HORA_ID, tecnicoId: 'tecnico-2' }),
    );

    const admin: Usuario = criarUsuarioFake({ id: 'admin-1', email: 'admin@example.com', papel: 'admin' });
    const tecnicoUser: Usuario = criarUsuarioFake({ id: 'tecnico-logado', email: 'tecnicologado@example.com' });
    adminToken = tokenService.gerarAccessToken(admin);
    tecnicoToken = tokenService.gerarAccessToken(tecnicoUser);

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerEstimativaCustoRoutes(app, {
      estimativaCustoOSRepository: new InMemoryEstimativaCustoOSRepository(),
      ordemServicoRepository,
      usuarioRepository,
    });
    await app.ready();
  });

  it('GET sem token retorna 401', async () => {
    const response = await app.inject({ method: 'GET', url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo` });
    expect(response.statusCode).toBe(401);
  });

  it('GET com papel nao-admin retorna 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET retorna null quando a OS ainda nao possui estimativa', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
  });

  it('GET com OS inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_INEXISTENTE_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('PUT sem token retorna 401', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      payload: { horas_estimadas_tecnico: 4 },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PUT com papel nao-admin retorna 403', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${tecnicoToken}` },
      payload: { horas_estimadas_tecnico: 4 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('PUT com OS sem tecnico atribuido retorna 400', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_SEM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { horas_estimadas_tecnico: 4 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PUT com tecnico sem valor/hora cadastrado retorna 400', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_TECNICO_SEM_VALOR_HORA_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { horas_estimadas_tecnico: 4 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PUT calcula e persiste a estimativa (sem ajudante)', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        horas_estimadas_tecnico: 4,
        custo_combustivel: 30,
        custo_pedagio: 10,
        custo_desgaste_veiculo: 20,
        outros_custos: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // (4 * 50) + 30 + 10 + 20 + 5 = 265
    expect(body.custo_total).toBe(265);
    expect(body.valor_hora_tecnico).toBe(50);
    expect(body.custo_almoco).toBe(0);
    expect(body.custo_janta).toBe(0);
    expect(body.custo_estadia).toBe(0);
    expect(body.turno).toBe('diurno');
    expect(body.custo_adicional_noturno).toBe(0);
  });

  it('PUT com almoco, janta e estadia soma corretamente ao custo total', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        horas_estimadas_tecnico: 4,
        custo_combustivel: 30,
        custo_pedagio: 10,
        custo_desgaste_veiculo: 20,
        custo_almoco: 15,
        custo_janta: 20,
        custo_estadia: 100,
        outros_custos: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // (4 * 50) + 30 + 10 + 20 + 15 + 20 + 100 + 5 = 400
    expect(body.custo_total).toBe(400);
    expect(body.custo_almoco).toBe(15);
    expect(body.custo_janta).toBe(20);
    expect(body.custo_estadia).toBe(100);
  });

  it('PUT com turno noturno inclui custo_adicional_noturno no custo total', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        horas_estimadas_tecnico: 4,
        turno: 'noturno',
        custo_adicional_noturno: 50,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // (4 * 50) + 50 = 250
    expect(body.custo_total).toBe(250);
    expect(body.turno).toBe('noturno');
    expect(body.custo_adicional_noturno).toBe(50);
  });

  it('PUT com turno diurno nao inclui custo_adicional_noturno no custo total mesmo informado', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_TECNICO_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        horas_estimadas_tecnico: 4,
        turno: 'diurno',
        custo_adicional_noturno: 50,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // (4 * 50) = 200 — custo_adicional_noturno persistido mas nao somado
    expect(body.custo_total).toBe(200);
    expect(body.turno).toBe('diurno');
    expect(body.custo_adicional_noturno).toBe(50);
  });

  it('PUT calcula e persiste a estimativa (com ajudante) e GET subsequente retorna o valor salvo', async () => {
    const putResponse = await app.inject({
      method: 'PUT',
      url: `/ordens-servico/${OS_COM_AJUDANTE_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        horas_estimadas_tecnico: 4,
        horas_estimadas_ajudante: 4,
        custo_combustivel: 30,
        custo_pedagio: 10,
        custo_desgaste_veiculo: 20,
        outros_custos: 5,
      },
    });

    expect(putResponse.statusCode).toBe(200);
    // (4 * 50) + (4 * 25) + 30 + 10 + 20 + 5 = 365
    expect(putResponse.json().custo_total).toBe(365);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/ordens-servico/${OS_COM_AJUDANTE_ID}/estimativa-custo`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().custo_total).toBe(365);
  });
});
