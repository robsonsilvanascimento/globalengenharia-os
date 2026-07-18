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
import type {
  AtualizarOrdemServicoDados,
  CriarOrdemServicoDados,
  ListarOrdensServicoFiltros,
  ListarOrdensServicoOpcoes,
  ListarOrdensServicoResultado,
  OrdemServicoRepository,
} from '../../../../ordens-servico/domain/OrdemServicoRepository';
import type { OrdemServico } from '../../../../ordens-servico/domain/OrdemServico';
import { registerMidiasRoutes } from '../routes';
import type { MidiaOrdemServico } from '../../../domain/MidiaOrdemServico';
import type {
  CriarMidiaOrdemServicoDados,
  MidiaOrdemServicoRepository,
} from '../../../domain/MidiaOrdemServicoRepository';
import {
  FakeArmazenamentoArquivoService,
} from '../../../application/__tests__/fakes';

/**
 * Repositorios em memoria usados apenas nestes testes de integracao leves das
 * rotas HTTP (fastify.inject), para nao depender de um Postgres real. LIMITACAO:
 * nao cobre comportamento especifico do Prisma/Postgres.
 */
class InMemoryMidiaOrdemServicoRepository implements MidiaOrdemServicoRepository {
  private midias: MidiaOrdemServico[] = [];
  private seq = 0;

  seed(midia: MidiaOrdemServico): void {
    this.midias.push(midia);
  }

  async create(dados: CriarMidiaOrdemServicoDados): Promise<MidiaOrdemServico> {
    this.seq += 1;
    const midia: MidiaOrdemServico = {
      id: `midia-${this.seq}`,
      ordemServicoId: dados.ordemServicoId,
      clienteId: dados.clienteId,
      tipo: dados.tipo,
      caminhoArmazenamento: dados.caminhoArmazenamento,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.tamanhoBytes,
      whatsappMediaId: dados.whatsappMediaId,
      criadoEm: new Date(),
    };
    this.midias.push(midia);
    return midia;
  }

  async findById(id: string): Promise<MidiaOrdemServico | null> {
    return this.midias.find((midia) => midia.id === id) ?? null;
  }

  async listByOrdemServicoId(ordemServicoId: string): Promise<MidiaOrdemServico[]> {
    return this.midias.filter((midia) => midia.ordemServicoId === ordemServicoId);
  }

  async delete(id: string): Promise<void> {
    this.midias = this.midias.filter((midia) => midia.id !== id);
  }
}

/** Fake minimo de OrdemServicoRepository: so `findById` e usado pelas rotas de midias. */
class FakeOrdemServicoRepository implements OrdemServicoRepository {
  private ordens: OrdemServico[] = [];

  seed(ordemServico: OrdemServico): void {
    this.ordens.push(ordemServico);
  }

  async create(_dados: CriarOrdemServicoDados): Promise<OrdemServico> {
    throw new Error('nao usado neste teste');
  }

  async findById(id: string): Promise<OrdemServico | null> {
    return this.ordens.find((ordem) => ordem.id === id) ?? null;
  }

  async findByNumero(_numero: string): Promise<OrdemServico | null> {
    throw new Error('nao usado neste teste');
  }

  async update(_id: string, _dados: AtualizarOrdemServicoDados): Promise<OrdemServico> {
    throw new Error('nao usado neste teste');
  }

  async list(
    _filtros: ListarOrdensServicoFiltros,
    _opcoes: ListarOrdensServicoOpcoes,
  ): Promise<ListarOrdensServicoResultado> {
    throw new Error('nao usado neste teste');
  }
}

function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  const agora = new Date();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    numero: 'OS-2026-000001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema de exemplo',
    prioridade: 'normal',
    status: 'aberta',
    criadoVia: 'painel',
    criadoEm: agora,
    atualizadoEm: agora,
    ...overrides,
  };
}

describe('rotas de midias (integracao leve, sem Postgres)', () => {
  let app: FastifyInstance;
  let midiaOrdemServicoRepository: InMemoryMidiaOrdemServicoRepository;
  let armazenamentoArquivoService: FakeArmazenamentoArquivoService;
  let ordemServicoRepository: FakeOrdemServicoRepository;
  let adminToken: string;
  let tecnicoToken: string;
  let atendenteToken: string;

  const tokenService = new JwtTokenService();
  const CONTEUDO_VIDEO = Buffer.from('conteudo-binario-do-video');

  beforeAll(async () => {
    midiaOrdemServicoRepository = new InMemoryMidiaOrdemServicoRepository();
    armazenamentoArquivoService = new FakeArmazenamentoArquivoService();
    ordemServicoRepository = new FakeOrdemServicoRepository();

    ordemServicoRepository.seed(criarOrdemServicoFake({ id: '99999999-9999-9999-9999-999999999999' }));

    armazenamentoArquivoService.arquivos.set('videos/video-1.mp4', CONTEUDO_VIDEO);
    midiaOrdemServicoRepository.seed({
      id: '11111111-1111-1111-1111-111111111111',
      ordemServicoId: '99999999-9999-9999-9999-999999999999',
      clienteId: 'cliente-1',
      tipo: 'video',
      caminhoArmazenamento: 'videos/video-1.mp4',
      mimeType: 'video/mp4',
      tamanhoBytes: CONTEUDO_VIDEO.length,
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
    const tecnico: Usuario = {
      id: 'tecnico-1',
      nome: 'Tecnico',
      email: 'tecnico@example.com',
      senhaHash: 'irrelevante',
      papel: 'tecnico',
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
    tecnicoToken = tokenService.gerarAccessToken(tecnico);
    atendenteToken = tokenService.gerarAccessToken(atendente);

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    registerMidiasRoutes(app, {
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
      ordemServicoRepository,
    });
    await app.ready();
  });

  describe('GET /ordens-servico/:id/midias', () => {
    it('sem token retorna 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias' });
      expect(response.statusCode).toBe(401);
    });

    it('com papel atendente retorna 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias',
        headers: { authorization: `Bearer ${atendenteToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('com papel tecnico retorna 200 e a lista de midias da OS', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias',
        headers: { authorization: `Bearer ${tecnicoToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: '11111111-1111-1111-1111-111111111111',
        ordem_servico_id: '99999999-9999-9999-9999-999999999999',
        tipo: 'video',
      });
    });

    it('com papel admin retorna 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('para OS inexistente retorna 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ordens-servico/00000000-0000-0000-0000-000000000000/midias',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /ordens-servico/:id/midias/:midiaId/arquivo', () => {
    const url = '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/11111111-1111-1111-1111-111111111111/arquivo';

    it('sem token retorna 401', async () => {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
    });

    it('com papel atendente retorna 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${atendenteToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('com papel tecnico retorna 200 com o binario e Content-Type correto', async () => {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${tecnicoToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.rawPayload.equals(CONTEUDO_VIDEO)).toBe(true);
    });

    it('com papel admin retorna 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('midia inexistente retorna 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/00000000-0000-0000-0000-000000000000/arquivo',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /ordens-servico/:id/midias/:midiaId', () => {
    it('sem token retorna 401', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/11111111-1111-1111-1111-111111111111',
      });
      expect(response.statusCode).toBe(401);
    });

    it('com papel tecnico retorna 403', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/11111111-1111-1111-1111-111111111111',
        headers: { authorization: `Bearer ${tecnicoToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('com papel admin remove a midia (arquivo e registro) e retorna 204', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/11111111-1111-1111-1111-111111111111',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(204);
      expect(await midiaOrdemServicoRepository.findById('11111111-1111-1111-1111-111111111111')).toBeNull();
      expect(armazenamentoArquivoService.arquivos.has('videos/video-1.mp4')).toBe(false);
    });

    it('midia ja removida retorna 404', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/ordens-servico/99999999-9999-9999-9999-999999999999/midias/11111111-1111-1111-1111-111111111111',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
