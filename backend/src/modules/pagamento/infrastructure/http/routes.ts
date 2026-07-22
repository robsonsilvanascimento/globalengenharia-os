import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { GerarPixUseCase } from '../../application/GerarPixUseCase';
import { registrarPagamentoManual } from '../../application/RegistrarPagamentoManualUseCase';
import { MercadoPagoGatewayAdapter } from '../mercadopago/MercadoPagoGatewayAdapter';
import { NotFoundError, ValidationError } from '../../../../shared/http/errors/AppError';
import { logger } from '../../../../shared/infra/Logger';

const osIdParamsSchema = z.object({ id: z.string().uuid() });

const pagamentoIdParamsSchema = z.object({
  id: z.string().uuid(),
  pagamentoId: z.string().uuid(),
});

const pagamentoManualBodySchema = z.object({
  valor: z.number().positive(),
  observacao: z.string().max(2000).optional(),
});

export function registerPagamentoRoutes(app: FastifyInstance): void {
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };
  const gateway = new MercadoPagoGatewayAdapter();

  app.post('/ordens-servico/:id/pagamentos/pix', somenteAdmin, async (request, reply) => {
    const { id } = osIdParamsSchema.parse(request.params);

    const pagamento = await GerarPixUseCase(
      { ordemServicoId: id, criadoPorId: request.user!.id },
      prisma,
    );

    return reply.status(201).send({
      id: pagamento.id,
      pix_qr_code: pagamento.pixQrCode,
      pix_copia_e_cola: pagamento.pixCopiaECola,
      valor: pagamento.valor,
      criado_em: pagamento.criadoEm,
    });
  });

  app.post('/ordens-servico/:id/pagamentos/manual', somenteAdmin, async (request, reply) => {
    const { id } = osIdParamsSchema.parse(request.params);
    const body = pagamentoManualBodySchema.parse(request.body);

    const pagamento = await registrarPagamentoManual({
      ordemServicoId: id,
      valor: body.valor,
      observacao: body.observacao,
      criadoPorId: request.user!.id,
    });

    return reply.status(201).send(pagamento);
  });

  app.get('/ordens-servico/:id/pagamentos', somenteAdmin, async (request, reply) => {
    const { id } = osIdParamsSchema.parse(request.params);

    const pagamentos = await prisma.pagamentoOS.findMany({
      where: { ordemServicoId: id },
      orderBy: { criadoEm: 'desc' },
      include: { comissao: true },
    });

    return reply.status(200).send(pagamentos);
  });

  app.patch(
    '/ordens-servico/:id/pagamentos/:pagamentoId/cancelar',
    somenteAdmin,
    async (request, reply) => {
      const { id, pagamentoId } = pagamentoIdParamsSchema.parse(request.params);

      const pagamento = await prisma.pagamentoOS.findUnique({ where: { id: pagamentoId } });
      if (!pagamento || pagamento.ordemServicoId !== id) {
        throw new NotFoundError('Pagamento nao encontrado');
      }

      if (pagamento.statusPagamento === 'cancelado') {
        return reply.status(200).send(pagamento);
      }

      if (pagamento.statusPagamento === 'pago') {
        throw new ValidationError(
          'Pagamento ja confirmado nao pode ser cancelado por aqui - trate como estorno manual',
        );
      }

      if (pagamento.tipo === 'pix_automatico' && pagamento.mercadoPagoId) {
        try {
          await gateway.cancelarCobranca(pagamento.mercadoPagoId);
        } catch (err) {
          // Se o gateway recusar o cancelamento (ex.: o cliente pagou
          // segundos antes desta chamada), nao atualizamos o status local:
          // isso deixaria o registro divergindo do que realmente aconteceu
          // no gateway (Pix pago, mas marcado como cancelado aqui).
          logger.error(
            { pagamentoOSId: pagamento.id, mercadoPagoId: pagamento.mercadoPagoId, err },
            'Falha ao cancelar Pix no gateway de pagamento',
          );
          throw new ValidationError(
            'Nao foi possivel cancelar o Pix no gateway de pagamento - verifique se ele ja foi pago',
          );
        }
      }

      const atualizado = await prisma.pagamentoOS.update({
        where: { id: pagamentoId },
        data: { statusPagamento: 'cancelado' },
      });

      const outrosPagos = await prisma.pagamentoOS.count({
        where: {
          ordemServicoId: id,
          statusPagamento: 'pago',
          id: { not: pagamentoId },
        },
      });

      if (outrosPagos === 0) {
        await prisma.ordemServico.update({
          where: { id },
          data: { statusPagamento: 'pendente' },
        });
      }

      return reply.status(200).send(atualizado);
    },
  );
}
