import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../../../shared/http/middlewares/error-handler';

const { getRedisMock, findUniqueNpsMock, findUniqueOsMock, createNpsMock, deleteMock } =
  vi.hoisted(() => ({
    getRedisMock: vi.fn(),
    findUniqueNpsMock: vi.fn(),
    findUniqueOsMock: vi.fn(),
    createNpsMock: vi.fn(),
    deleteMock: vi.fn(),
  }));

vi.mock('../infrastructure/tokens/TokenNpsStore', () => ({
  getOrdemServicoIdByToken: getRedisMock,
  deleteNpsToken: deleteMock,
}));

const { authenticateMock, requireRoleMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock('../../../shared/http/middlewares/auth', () => ({
  authenticate: authenticateMock,
  requireRole: (_roles: string[]) => requireRoleMock,
}));

import { registerNpsRoutes } from '../infrastructure/http/routes';

const OS_ID = '00000000-0000-0000-0000-000000000001';
const CLIENTE_ID = '00000000-0000-0000-0000-000000000002';
const VALID_TOKEN = 'token-valido';

function buildPrisma() {
  return {
    respostaNPS: {
      findUnique: findUniqueNpsMock,
      create: createNpsMock,
      findMany: vi.fn().mockResolvedValue([]),
    },
    ordemServico: {
      findUnique: findUniqueOsMock,
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

function buildRedis() {
  return {} as import('ioredis').Redis;
}

describe('POST /nps/:token', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    getRedisMock.mockReset();
    findUniqueNpsMock.mockReset();
    findUniqueOsMock.mockReset();
    createNpsMock.mockReset();
    deleteMock.mockReset();

    app = Fastify();
    app.setErrorHandler(errorHandler);
    registerNpsRoutes(app, { prisma: buildPrisma(), redis: buildRedis() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('nota valida (5) cria RespostaNPS e retorna 201', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);
    findUniqueOsMock.mockResolvedValue({ clienteId: CLIENTE_ID });
    createNpsMock.mockResolvedValue({});
    deleteMock.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 5 },
    });

    expect(res.statusCode).toBe(201);
    expect(createNpsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nota: 5, ordemServicoId: OS_ID }),
      }),
    );
  });

  it('nota 0 (limite inferior) cria RespostaNPS e retorna 201', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);
    findUniqueOsMock.mockResolvedValue({ clienteId: CLIENTE_ID });
    createNpsMock.mockResolvedValue({});
    deleteMock.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 0 },
    });

    expect(res.statusCode).toBe(201);
  });

  it('nota 10 (limite superior) cria RespostaNPS e retorna 201', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);
    findUniqueOsMock.mockResolvedValue({ clienteId: CLIENTE_ID });
    createNpsMock.mockResolvedValue({});
    deleteMock.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 10 },
    });

    expect(res.statusCode).toBe(201);
  });

  it('nota invalida (11) retorna 400', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 11 },
    });

    expect(res.statusCode).toBe(400);
    expect(createNpsMock).not.toHaveBeenCalled();
  });

  it('nota invalida (-1) retorna 400', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: -1 },
    });

    expect(res.statusCode).toBe(400);
    expect(createNpsMock).not.toHaveBeenCalled();
  });

  it('token expirado/invalido retorna 400', async () => {
    getRedisMock.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/nps/token-invalido',
      payload: { nota: 8 },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Link inválido ou expirado');
    expect(createNpsMock).not.toHaveBeenCalled();
  });

  it('segunda resposta para o mesmo token retorna 409', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue({ ordemServicoId: OS_ID, nota: 9 });

    const res = await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 7 },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('NPS já respondido');
    expect(createNpsMock).not.toHaveBeenCalled();
  });

  it('deleta o token apos resposta bem-sucedida', async () => {
    getRedisMock.mockResolvedValue(OS_ID);
    findUniqueNpsMock.mockResolvedValue(null);
    findUniqueOsMock.mockResolvedValue({ clienteId: CLIENTE_ID });
    createNpsMock.mockResolvedValue({});
    deleteMock.mockResolvedValue(undefined);

    await app.inject({
      method: 'POST',
      url: `/nps/${VALID_TOKEN}`,
      payload: { nota: 9 },
    });

    expect(deleteMock).toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, OS_ID);
  });
});

describe('GET /nps/resultados', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    authenticateMock.mockReset();
    requireRoleMock.mockReset();

    app = Fastify();
    app.setErrorHandler(errorHandler);
    registerNpsRoutes(app, { prisma: buildPrisma(), redis: buildRedis() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sem token (401) - authenticate lanca UnauthorizedError', async () => {
    const { UnauthorizedError } = await import('../../../shared/http/errors/AppError');
    authenticateMock.mockRejectedValue(new UnauthorizedError('Token de autenticacao ausente'));

    const res = await app.inject({ method: 'GET', url: '/nps/resultados' });

    expect(res.statusCode).toBe(401);
  });

  it('role tecnico retorna 403 - requireRole lanca ForbiddenError', async () => {
    const { ForbiddenError } = await import('../../../shared/http/errors/AppError');
    authenticateMock.mockResolvedValue(undefined);
    requireRoleMock.mockRejectedValue(new ForbiddenError('Acesso negado para o papel atual'));

    const res = await app.inject({
      method: 'GET',
      url: '/nps/resultados',
      headers: { authorization: 'Bearer token-tecnico' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('role admin retorna 200 com score e distribuicao', async () => {
    authenticateMock.mockResolvedValue(undefined);
    requireRoleMock.mockResolvedValue(undefined);

    const prisma = buildPrisma();
    (prisma.respostaNPS.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { nota: 10, comentario: null, criadoEm: new Date(), ordemServico: { numero: 'OS-001' }, cliente: { nome: 'Ana' } },
      { nota: 9, comentario: null, criadoEm: new Date(), ordemServico: { numero: 'OS-002' }, cliente: { nome: 'Beto' } },
      { nota: 7, comentario: null, criadoEm: new Date(), ordemServico: { numero: 'OS-003' }, cliente: { nome: 'Carol' } },
      { nota: 3, comentario: null, criadoEm: new Date(), ordemServico: { numero: 'OS-004' }, cliente: { nome: 'Davi' } },
    ]);

    const localApp = Fastify();
    localApp.setErrorHandler(errorHandler);
    registerNpsRoutes(localApp, { prisma, redis: buildRedis() });
    await localApp.ready();

    const res = await localApp.inject({ method: 'GET', url: '/nps/resultados' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('total', 4);
    expect(body).toHaveProperty('promotores', 2);
    expect(body).toHaveProperty('neutros', 1);
    expect(body).toHaveProperty('detratores', 1);
    expect(body).toHaveProperty('score_nps');
    expect(Array.isArray(body.respostas)).toBe(true);

    await localApp.close();
  });
});
