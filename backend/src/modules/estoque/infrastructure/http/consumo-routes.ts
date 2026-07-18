import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { enqueueAlertaEstoque } from '../queues/alerta-estoque-queue';

const consumoBodySchema = z.object({
  peca_id: z.string().uuid(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive().optional(),
});

const STATUS_OS_PERMITIDOS = ['triagem', 'atribuida', 'em_andamento', 'aguardando_peca'] as const;

export function registerConsumoPecasRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  const { prisma } = deps;

  app.post(
    '/ordens-servico/:id/consumo-pecas',
    { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = consumoBodySchema.parse(request.body);
      const userId = request.user!.id;

      const os = await prisma.ordemServico.findUniqueOrThrow({ where: { id } });

      if (!STATUS_OS_PERMITIDOS.includes(os.status as (typeof STATUS_OS_PERMITIDOS)[number])) {
        return reply.status(422).send({ error: 'Status da OS não permite consumo de peças' });
      }

      const peca = await prisma.peca.findUniqueOrThrow({ where: { id: body.peca_id } });

      if (!peca.ativo) {
        return reply.status(422).send({ error: 'Peça inativa' });
      }

      if (peca.estoqueAtual < body.quantidade) {
        return reply.status(422).send({ error: 'Estoque insuficiente' });
      }

      const precoUnitario = body.preco_unitario ?? peca.precoUnitario;
      const subtotal = body.quantidade * precoUnitario;

      const consumo = await prisma.$transaction(async (tx) => {
        const novoConsumo = await tx.consumoOSPeca.create({
          data: {
            ordemServicoId: id,
            pecaId: body.peca_id,
            quantidade: body.quantidade,
            precoUnitario,
            subtotal,
          },
        });

        await tx.movimentacaoEstoque.create({
          data: {
            pecaId: body.peca_id,
            tipo: 'saida',
            quantidade: body.quantidade,
            precoUnitario,
            ordemServicoId: id,
            criadoPorId: userId,
          },
        });

        await tx.peca.update({
          where: { id: body.peca_id },
          data: { estoqueAtual: { decrement: body.quantidade } },
        });

        const soma = await tx.consumoOSPeca.aggregate({
          where: { ordemServicoId: id },
          _sum: { subtotal: true },
        });

        await tx.ordemServico.update({
          where: { id },
          data: { custoTotalPecas: soma._sum.subtotal ?? 0 },
        });

        return novoConsumo;
      });

      // Alerta so quando o consumo CRUZA o limiar (estava acima do minimo e
      // ficou no/abaixo dele) — evita disparar um alerta a cada consumo
      // enquanto a peca ja esta em falta.
      const estoqueAposConsumo = peca.estoqueAtual - body.quantidade;
      const cruzouLimiar =
        peca.estoqueAtual > peca.estoqueMinimo && estoqueAposConsumo <= peca.estoqueMinimo;
      if (cruzouLimiar) {
        await enqueueAlertaEstoque({
          pecaId: peca.id,
          estoqueAtual: estoqueAposConsumo,
          estoqueMinimo: peca.estoqueMinimo,
        });
      }

      return reply.status(201).send(consumo);
    },
  );

  app.get(
    '/ordens-servico/:id/consumo-pecas',
    { preHandler: [authenticate, requireRole(['admin', 'tecnico', 'atendente'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const consumos = await prisma.consumoOSPeca.findMany({
        where: { ordemServicoId: id },
        include: {
          peca: { select: { nome: true, codigo: true, unidade: true } },
        },
      });

      const custo_total = consumos.reduce((acc: number, c) => acc + c.subtotal, 0);

      return reply.status(200).send({ consumos, custo_total });
    },
  );

  app.delete(
    '/ordens-servico/:id/consumo-pecas/:consumoId',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const { id, consumoId } = request.params as { id: string; consumoId: string };

      const consumo = await prisma.consumoOSPeca.findUniqueOrThrow({ where: { id: consumoId } });

      await prisma.$transaction(async (tx) => {
        await tx.peca.update({
          where: { id: consumo.pecaId },
          data: { estoqueAtual: { increment: consumo.quantidade } },
        });

        await tx.movimentacaoEstoque.create({
          data: {
            pecaId: consumo.pecaId,
            tipo: 'entrada',
            quantidade: consumo.quantidade,
            precoUnitario: consumo.precoUnitario,
            ordemServicoId: id,
            observacao: 'Estorno',
          },
        });

        await tx.consumoOSPeca.delete({ where: { id: consumoId } });

        const soma = await tx.consumoOSPeca.aggregate({
          where: { ordemServicoId: id },
          _sum: { subtotal: true },
        });

        await tx.ordemServico.update({
          where: { id },
          data: { custoTotalPecas: soma._sum.subtotal ?? 0 },
        });
      });

      return reply.status(204).send();
    },
  );
}
