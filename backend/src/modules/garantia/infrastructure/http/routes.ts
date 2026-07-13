import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

export interface AlertaGarantiaDTO {
  id: string;
  componenteId: string;
  componenteNome: string;
  diasRestantes: number;
  lido: boolean;
  criadoEm: string;
}

const listQuerySchema = z.object({
  lido: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export function registerAlertasGarantiaRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  app.get(
    '/alertas-garantia',
    { preHandler: [authenticate, requireRole(['admin', 'atendente'])] },
    async (request, reply) => {
      const { lido, page, page_size } = listQuerySchema.parse(request.query);
      const lidoFilter = lido === undefined ? undefined : lido === 'true';
      const skip = (page - 1) * page_size;

      const [items, total] = await Promise.all([
        deps.prisma.alertaGarantia.findMany({
          where: lidoFilter !== undefined ? { lido: lidoFilter } : undefined,
          include: { componente: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: page_size,
        }),
        deps.prisma.alertaGarantia.count({
          where: lidoFilter !== undefined ? { lido: lidoFilter } : undefined,
        }),
      ]);

      const dtos: AlertaGarantiaDTO[] = items.map((a) => ({
        id: a.id,
        componenteId: a.componenteId,
        componenteNome: a.componente.nome,
        diasRestantes: a.diasRestantes,
        lido: a.lido,
        criadoEm: a.criadoEm.toISOString(),
      }));

      return reply.send({ items: dtos, total });
    },
  );

  app.patch(
    '/alertas-garantia/:id/lido',
    { preHandler: [authenticate, requireRole(['admin', 'atendente'])] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);

      const alerta = await deps.prisma.alertaGarantia.findUnique({ where: { id } });
      if (!alerta) throw new NotFoundError('Alerta de garantia não encontrado');

      await deps.prisma.alertaGarantia.update({ where: { id }, data: { lido: true } });

      return reply.send({ ok: true });
    },
  );
}
