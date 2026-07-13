import { createHash, randomBytes } from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { buildApiKeyAuth } from './middlewares/apiKeyAuth';
import { buildApiKeyRateLimit } from './middlewares/apiKeyRateLimit';

const paginacaoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ordensQuerySchema = paginacaoSchema.extend({
  status: z.string().optional(),
});

const criarApiKeyBodySchema = z.object({
  nome: z.string().min(1),
});

export function registerApiPublicaRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; redis: Redis },
): void {
  const apiKeyAuth = buildApiKeyAuth(deps);
  const apiKeyRateLimit = buildApiKeyRateLimit(deps);

  const publicPreHandler = [apiKeyAuth, apiKeyRateLimit];

  // ── Endpoints públicos (autenticados via API Key) ──────────────────────────

  app.get(
    '/api/v1/ordens-servico',
    { preHandler: publicPreHandler },
    async (request, reply) => {
      const { status, page, limit } = ordensQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;

      const where = status ? { status: status as never } : {};

      const [total, data] = await Promise.all([
        deps.prisma.ordemServico.count({ where }),
        deps.prisma.ordemServico.findMany({
          where,
          skip,
          take: limit,
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            numero: true,
            status: true,
            criadoEm: true,
            fechadoEm: true,
            cliente: { select: { nome: true } },
            tecnico: { select: { nome: true } },
          },
        }),
      ]);

      return reply.send({
        data: data.map((os) => ({
          id: os.id,
          numero: os.numero,
          status: os.status,
          criadoEm: os.criadoEm,
          concluidoEm: os.fechadoEm,
          cliente: { nome: os.cliente.nome },
          tecnico: os.tecnico ? { nome: os.tecnico.nome } : null,
        })),
        total,
        page,
        limit,
      });
    },
  );

  app.get(
    '/api/v1/ordens-servico/:id',
    { preHandler: publicPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const os = await deps.prisma.ordemServico.findUnique({
        where: { id },
        select: {
          id: true,
          numero: true,
          status: true,
          criadoEm: true,
          fechadoEm: true,
          cliente: { select: { nome: true } },
          tecnico: { select: { nome: true } },
          estimativaCusto: {
            select: { custoTotal: true },
          },
        },
      });

      if (!os) {
        return reply.status(404).send({ error: 'Ordem de serviço não encontrada' });
      }

      return reply.send({
        id: os.id,
        numero: os.numero,
        status: os.status,
        criadoEm: os.criadoEm,
        concluidoEm: os.fechadoEm,
        cliente: { nome: os.cliente.nome },
        tecnico: os.tecnico ? { nome: os.tecnico.nome } : null,
        estimativaCusto: os.estimativaCusto
          ? { custoTotal: os.estimativaCusto.custoTotal }
          : null,
      });
    },
  );

  app.get(
    '/api/v1/clientes',
    { preHandler: publicPreHandler },
    async (request, reply) => {
      const { page, limit } = paginacaoSchema.parse(request.query);
      const skip = (page - 1) * limit;

      const [total, data] = await Promise.all([
        deps.prisma.cliente.count(),
        deps.prisma.cliente.findMany({
          skip,
          take: limit,
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            nome: true,
            email: true,
            telefoneWhatsapp: true,
            criadoEm: true,
          },
        }),
      ]);

      return reply.send({
        data: data.map((c) => ({
          id: c.id,
          nome: c.nome,
          email: c.email,
          telefone: c.telefoneWhatsapp,
          criadoEm: c.criadoEm,
        })),
        total,
      });
    },
  );

  // ── Endpoints internos (autenticados via JWT, role admin) ──────────────────

  app.post(
    '/api-keys',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { nome } = criarApiKeyBodySchema.parse(request.body);
      const usuarioId = request.user!.id;

      const chave = `gea_${randomBytes(32).toString('hex')}`;
      const hash = createHash('sha256').update(chave).digest('hex');
      const prefixo = chave.substring(0, 8);

      const apiKey = await deps.prisma.apiKey.create({
        data: {
          nome,
          hash,
          prefixo,
          criadoPorId: usuarioId,
        },
      });

      return reply.status(201).send({
        id: apiKey.id,
        nome: apiKey.nome,
        prefixo: apiKey.prefixo,
        chave, // única vez que a chave real é retornada
        criadoEm: apiKey.criadoEm,
      });
    },
  );

  app.get(
    '/api-keys',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (_request, reply) => {
      const apiKeys = await deps.prisma.apiKey.findMany({
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          nome: true,
          prefixo: true,
          ativa: true,
          criadoEm: true,
          ultimoUsoEm: true,
        },
      });

      return reply.send(apiKeys);
    },
  );

  app.delete(
    '/api-keys/:id',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await deps.prisma.apiKey.findUnique({ where: { id } });

      if (!existing) {
        return reply.status(404).send({ error: 'API key não encontrada' });
      }

      await deps.prisma.apiKey.update({
        where: { id },
        data: { ativa: false },
      });

      return reply.status(204).send();
    },
  );
}
