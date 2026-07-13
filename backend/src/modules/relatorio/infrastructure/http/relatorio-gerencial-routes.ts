import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const bodySchema = z.object({
  frequencia: z.enum(['semanal', 'mensal']),
  email_destino: z.string().email(),
});

export function registerRelatorioGerencialRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; relatorioQueue: Queue },
): void {
  const { prisma, relatorioQueue } = deps;

  const soAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  app.get('/relatorio-gerencial/config', soAdmin, async (_request, reply) => {
    const config = await prisma.configRelatorioGerencial.findFirst({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
    });
    return reply.send(config ?? null);
  });

  app.post('/relatorio-gerencial/config', soAdmin, async (request, reply) => {
    const { frequencia, email_destino: emailDestino } = bodySchema.parse(request.body);

    await prisma.configRelatorioGerencial.updateMany({ data: { ativo: false } });

    const config = await prisma.configRelatorioGerencial.create({
      data: { frequencia, emailDestino, ativo: true },
    });

    const cron = frequencia === 'semanal' ? '0 7 * * 1' : '0 7 1 * *';

    await relatorioQueue.add(
      'gerar',
      { configId: config.id },
      { repeat: { pattern: cron }, jobId: 'relatorio-gerencial' },
    );

    return reply.send(config);
  });
}
