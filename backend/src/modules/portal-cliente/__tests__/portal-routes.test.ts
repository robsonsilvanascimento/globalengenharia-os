import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../../../shared/http/middlewares/error-handler';

const {
  findUniqueTokenMock,
  findManyOsMock,
  findUniqueOsMock,
  findFirstDocMock,
  lerArquivoMock,
} = vi.hoisted(() => ({
  findUniqueTokenMock: vi.fn(),
  findManyOsMock: vi.fn(),
  findUniqueOsMock: vi.fn(),
  findFirstDocMock: vi.fn(),
  lerArquivoMock: vi.fn(),
}));

import { registerPortalClienteRoutes } from '../infrastructure/http/routes';

const CLIENTE_ID = 'cliente-uuid-0001';
const OS_ID = '00000000-0000-0000-0000-000000000010';
const OUTRO_CLIENTE_ID = 'cliente-uuid-9999';
const VALID_TOKEN = 'portal-token-valido';

const futureDate = new Date(Date.now() + 1000 * 60 * 60);
const pastDate = new Date(Date.now() - 1000);

function buildPrisma(overrides?: Partial<{
  tokenPortalCliente: { findUnique: ReturnType<typeof vi.fn> };
  ordemServico: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  documentoOS: { findFirst: ReturnType<typeof vi.fn> };
}>) {
  return {
    tokenPortalCliente: {
      findUnique: overrides?.tokenPortalCliente?.findUnique ?? findUniqueTokenMock,
    },
    ordemServico: {
      findMany: overrides?.ordemServico?.findMany ?? findManyOsMock,
      findUnique: overrides?.ordemServico?.findUnique ?? findUniqueOsMock,
    },
    documentoOS: {
      findFirst: overrides?.documentoOS?.findFirst ?? findFirstDocMock,
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

function buildStorage() {
  return { lerArquivo: lerArquivoMock } as unknown as import('../../../shared/infra/storage/ArmazenamentoArquivoService').ArmazenamentoArquivoService;
}

describe('GET /portal/os', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    findUniqueTokenMock.mockReset();
    findManyOsMock.mockReset();

    app = Fastify();
    app.setErrorHandler(errorHandler);
    registerPortalClienteRoutes(app, { prisma: buildPrisma(), armazenamentoArquivoService: buildStorage() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('token valido retorna lista de OS do cliente (200)', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });
    findManyOsMock.mockResolvedValue([
      {
        id: OS_ID,
        numero: 'OS-001',
        status: 'aberta',
        prioridade: 'normal',
        descricaoProblema: 'Vazamento',
        criadoEm: new Date(),
        valorCobrado: null,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/portal/os',
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('numero', 'OS-001');
  });

  it('sem token retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/portal/os' });

    expect(res.statusCode).toBe(401);
  });

  it('token expirado retorna 401', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: pastDate });

    const res = await app.inject({
      method: 'GET',
      url: '/portal/os',
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(401);
  });

  it('token inexistente retorna 401', async () => {
    findUniqueTokenMock.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/portal/os',
      headers: { 'x-portal-token': 'token-nao-existe' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('filtra OS pelo clienteId do token (findMany recebe where correto)', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });
    findManyOsMock.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/portal/os',
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(findManyOsMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: CLIENTE_ID } }),
    );
  });
});

describe('GET /portal/os/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    findUniqueTokenMock.mockReset();
    findUniqueOsMock.mockReset();

    app = Fastify();
    app.setErrorHandler(errorHandler);
    registerPortalClienteRoutes(app, { prisma: buildPrisma(), armazenamentoArquivoService: buildStorage() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('token valido e OS do proprio cliente retorna 200', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });
    findUniqueOsMock.mockResolvedValue({
      id: OS_ID,
      numero: 'OS-001',
      status: 'aberta',
      prioridade: 'normal',
      descricaoProblema: 'Vazamento',
      criadoEm: new Date(),
      valorCobrado: null,
      clienteId: CLIENTE_ID,
      historicoStatus: [],
      fotosServico: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/portal/os/${OS_ID}`,
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id', OS_ID);
    expect(body).toHaveProperty('historico_status');
    expect(body).toHaveProperty('fotos_servico');
  });

  it('OS pertence a outro cliente retorna 404', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });
    findUniqueOsMock.mockResolvedValue({
      id: OS_ID,
      numero: 'OS-002',
      status: 'aberta',
      prioridade: 'normal',
      descricaoProblema: 'Outro problema',
      criadoEm: new Date(),
      valorCobrado: null,
      clienteId: OUTRO_CLIENTE_ID,
      historicoStatus: [],
      fotosServico: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/portal/os/${OS_ID}`,
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(404);
  });

  it('OS inexistente retorna 404', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });
    findUniqueOsMock.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/portal/os/${OS_ID}`,
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(404);
  });

  it('token expirado retorna 401', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: pastDate });

    const res = await app.inject({
      method: 'GET',
      url: `/portal/os/${OS_ID}`,
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(401);
  });

  it('id com formato invalido (nao-UUID) retorna 400', async () => {
    findUniqueTokenMock.mockResolvedValue({ token: VALID_TOKEN, clienteId: CLIENTE_ID, expiraEm: futureDate });

    const res = await app.inject({
      method: 'GET',
      url: '/portal/os/nao-e-uuid',
      headers: { 'x-portal-token': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(400);
  });
});
