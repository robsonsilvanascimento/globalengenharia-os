import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import {
  getOrdemServicoIdByToken,
  deleteNpsToken,
} from '../tokens/TokenNpsStore';

const responderBodySchema = z.object({
  nota: z.number().int().min(0).max(10),
  comentario: z.string().optional(),
});

const resultadosQuerySchema = z.object({
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
});

export function registerNpsRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; redis: Redis },
): void {
  app.post<{ Params: { token: string } }>(
    '/nps/:token',
    async (request, reply) => {
      const { token } = request.params;
      const { nota, comentario } = responderBodySchema.parse(request.body);

      const ordemServicoId = await getOrdemServicoIdByToken(deps.redis, token);

      if (!ordemServicoId) {
        return reply.status(400).send({ error: 'Link inválido ou expirado' });
      }

      const jaRespondido = await deps.prisma.respostaNPS.findUnique({
        where: { ordemServicoId },
      });

      if (jaRespondido) {
        return reply.status(409).send({ error: 'NPS já respondido' });
      }

      const os = await deps.prisma.ordemServico.findUnique({
        where: { id: ordemServicoId },
        select: { clienteId: true },
      });

      if (!os) {
        return reply.status(400).send({ error: 'Link inválido ou expirado' });
      }

      await deps.prisma.respostaNPS.create({
        data: {
          ordemServicoId,
          clienteId: os.clienteId,
          nota,
          comentario,
        },
      });

      await deleteNpsToken(deps.redis, token, ordemServicoId);

      return reply.status(201).send({ mensagem: 'Obrigado pela sua avaliação!' });
    },
  );

  app.get(
    '/nps/resultados',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { dataInicio, dataFim } = resultadosQuerySchema.parse(request.query);

      const where: Record<string, unknown> = {};
      if (dataInicio || dataFim) {
        where.criadoEm = {
          ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
          ...(dataFim ? { lte: new Date(dataFim) } : {}),
        };
      }

      const respostas = await deps.prisma.respostaNPS.findMany({
        where,
        include: {
          ordemServico: { select: { numero: true } },
          cliente: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
      });

      const total = respostas.length;
      const promotores = respostas.filter((r) => r.nota >= 9).length;
      const neutros = respostas.filter((r) => r.nota >= 7 && r.nota <= 8).length;
      const detratores = respostas.filter((r) => r.nota <= 6).length;
      const score_nps = total > 0 ? ((promotores - detratores) / total) * 100 : 0;

      return reply.status(200).send({
        total,
        promotores,
        neutros,
        detratores,
        score_nps: Math.round(score_nps * 10) / 10,
        respostas: respostas.map((r) => ({
          nota: r.nota,
          comentario: r.comentario,
          criado_em: r.criadoEm,
          ordem_servico_numero: r.ordemServico.numero,
          cliente_nome: r.cliente.nome,
        })),
      });
    },
  );
}
