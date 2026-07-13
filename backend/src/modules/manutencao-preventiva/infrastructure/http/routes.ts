import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const componenteParamsSchema = z.object({
  componenteId: z.string().uuid(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const criarBodySchema = z.object({
  intervalo_dias: z.number().int().positive(),
});

const realizadaBodySchema = z.object({
  observacao: z.string().optional(),
});

const atualizarBodySchema = z.object({
  intervalo_dias: z.number().int().positive().optional(),
});

const listQuerySchema = z.object({
  vencendo_em_dias: z.coerce.number().int().positive().default(30),
});

export function registerManutencaoPreventivaRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  app.post(
    '/componentes/:componenteId/manutencao-preventiva',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { componenteId } = componenteParamsSchema.parse(request.params);
      const { intervalo_dias } = criarBodySchema.parse(request.body);

      const proximaEm = new Date(Date.now() + intervalo_dias * 24 * 60 * 60 * 1000);

      const manutencao = await deps.prisma.manutencaoPreventiva.create({
        data: {
          componenteInstaladoId: componenteId,
          intervaloDias: intervalo_dias,
          proximaEm,
        },
      });

      return reply.status(201).send(manutencao);
    },
  );

  app.get(
    '/componentes/:componenteId/manutencao-preventiva',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { componenteId } = componenteParamsSchema.parse(request.params);

      const manutencao = await deps.prisma.manutencaoPreventiva.findFirst({
        where: { componenteInstaladoId: componenteId },
        include: {
          componenteInstalado: {
            select: { nome: true, ordemServicoId: true },
          },
        },
      });

      if (!manutencao) throw new NotFoundError('Manutenção preventiva não encontrada');

      return reply.send(manutencao);
    },
  );

  app.patch(
    '/manutencoes-preventivas/:id/realizada',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      realizadaBodySchema.parse(request.body);

      const manutencao = await deps.prisma.manutencaoPreventiva.findUnique({ where: { id } });
      if (!manutencao) throw new NotFoundError('Manutenção preventiva não encontrada');

      const agora = new Date();
      const proximaEm = new Date(Date.now() + manutencao.intervaloDias * 24 * 60 * 60 * 1000);

      const atualizado = await deps.prisma.manutencaoPreventiva.update({
        where: { id },
        data: {
          ultimaRealizadaEm: agora,
          proximaEm,
          notificadoEm: null,
        },
      });

      return reply.send(atualizado);
    },
  );

  app.get(
    '/manutencoes-preventivas',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { vencendo_em_dias } = listQuerySchema.parse(request.query);
      const limite = new Date(Date.now() + vencendo_em_dias * 24 * 60 * 60 * 1000);

      const items = await deps.prisma.manutencaoPreventiva.findMany({
        where: {
          proximaEm: { lte: limite },
        },
        include: {
          componenteInstalado: {
            select: {
              nome: true,
              ordemServico: {
                select: {
                  numero: true,
                  cliente: { select: { nome: true } },
                },
              },
            },
          },
        },
        orderBy: { proximaEm: 'asc' },
      });

      return reply.send(items);
    },
  );

  app.put(
    '/manutencoes-preventivas/:id',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const { intervalo_dias } = atualizarBodySchema.parse(request.body);

      const manutencao = await deps.prisma.manutencaoPreventiva.findUnique({ where: { id } });
      if (!manutencao) throw new NotFoundError('Manutenção preventiva não encontrada');

      const base = manutencao.ultimaRealizadaEm ?? manutencao.criadoEm;
      const novoIntervaloDias = intervalo_dias ?? manutencao.intervaloDias;
      const proximaEm = new Date(base.getTime() + novoIntervaloDias * 24 * 60 * 60 * 1000);

      const atualizado = await deps.prisma.manutencaoPreventiva.update({
        where: { id },
        data: {
          intervaloDias: novoIntervaloDias,
          proximaEm,
        },
      });

      return reply.send(atualizado);
    },
  );
}
