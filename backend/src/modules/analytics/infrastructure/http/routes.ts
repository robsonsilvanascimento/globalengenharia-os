import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { ResumoAnalyticsUseCase } from '../../application/ResumoAnalyticsUseCase';

const resumoQuerySchema = z.object({
  data_inicio: z.string().datetime().optional(),
  data_fim: z.string().datetime().optional(),
});

export function registerAnalyticsRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  const resumoAnalyticsUseCase = new ResumoAnalyticsUseCase({ prisma: deps.prisma });

  app.get(
    '/analytics/resumo',
    { preHandler: [authenticate, requireRole(['admin', 'atendente'])] },
    async (request, reply) => {
      const query = resumoQuerySchema.parse(request.query);

      const resultado = await resumoAnalyticsUseCase.execute({
        dataInicio: query.data_inicio ? new Date(query.data_inicio) : undefined,
        dataFim: query.data_fim ? new Date(query.data_fim) : undefined,
      });

      return reply.status(200).send(resultado);
    },
  );
}
