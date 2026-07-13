import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError } from '../../../../shared/http/errors/AppError';

const osIdParams = z.object({ id: z.string().uuid() });

const assinaturaBody = z.object({
  imagemBase64: z.string().min(1),
});

export function registerAssinaturaOSRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  const { prisma } = deps;

  app.post(
    '/ordens-servico/:id/assinatura',
    { preHandler: [authenticate, requireRole(['tecnico', 'admin'])] },
    async (request, reply) => {
      const { id } = osIdParams.parse(request.params);
      const { imagemBase64 } = assinaturaBody.parse(request.body);

      const os = await prisma.ordemServico.findUnique({ where: { id } });
      if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

      const assinatura = await prisma.assinaturaOS.upsert({
        where: { ordemServicoId: id },
        create: { ordemServicoId: id, imagemBase64 },
        update: { imagemBase64 },
      });

      return reply.status(201).send({
        id: assinatura.id,
        ordem_servico_id: assinatura.ordemServicoId,
        criado_em: assinatura.criadoEm,
      });
    },
  );

  app.get(
    '/ordens-servico/:id/assinatura',
    { preHandler: [authenticate, requireRole(['tecnico', 'admin', 'atendente'])] },
    async (request, reply) => {
      const { id } = osIdParams.parse(request.params);

      const assinatura = await prisma.assinaturaOS.findUnique({ where: { ordemServicoId: id } });
      if (!assinatura) throw new NotFoundError('Assinatura nao encontrada');

      return reply.status(200).send({
        id: assinatura.id,
        ordem_servico_id: assinatura.ordemServicoId,
        imagem_base64: assinatura.imagemBase64,
        criado_em: assinatura.criadoEm,
      });
    },
  );
}
