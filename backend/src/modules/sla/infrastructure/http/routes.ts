import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const prioridadeSchema = z.enum(['baixa', 'normal', 'alta', 'urgente']);

const putBodySchema = z.object({
  prazo_horas: z.number().int().positive(),
});

export function registerSlaRoutes(app: FastifyInstance, deps: { prisma: PrismaClient }): void {
  const { prisma } = deps;

  app.get('/sla/config', { preHandler: [authenticate, requireRole(['admin'])] }, async (_request, reply) => {
    const configs = await prisma.slaConfig.findMany({ orderBy: { prazoHoras: 'asc' } });
    return reply.status(200).send(configs);
  });

  app.put('/sla/config/:prioridade', { preHandler: [authenticate, requireRole(['admin'])] }, async (request, reply) => {
    const { prioridade } = z.object({ prioridade: prioridadeSchema }).parse(request.params);
    const body = putBodySchema.parse(request.body);

    const updated = await prisma.slaConfig.update({
      where: { prioridade },
      data: { prazoHoras: body.prazo_horas },
    });

    return reply.status(200).send(updated);
  });
}
