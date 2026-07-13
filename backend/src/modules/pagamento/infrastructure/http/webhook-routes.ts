import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Payment } from 'mercadopago';
import type { PrismaClient } from '@prisma/client';
import { mercadoPagoClient } from '../mercadopago/MercadoPagoService';
import { enqueueCalcularComissao } from '../queues/comissao-queue';
import { logger } from '../../../../shared/infra/Logger';

interface WebhookBody {
  type?: string;
  data?: { id?: string };
}

function verifySignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const xSignature = headers['x-signature'] as string | undefined;
  const requestId = headers['x-request-id'] as string | undefined;

  if (!xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split('&').map((p) => p.split('=')),
  ) as Record<string, string>;

  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) return false;

  let dataId: string | undefined;
  try {
    const parsed = JSON.parse(rawBody) as WebhookBody;
    dataId = parsed?.data?.id;
  } catch {
    return false;
  }

  const manifest = `id:${dataId ?? ''};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export function registerWebhookMercadoPagoRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
): void {
  app.post('/webhooks/mercadopago', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(request.body);

    const valid = verifySignature(rawBody, request.headers as Record<string, string | string[] | undefined>);
    if (!valid) {
      logger.warn({ url: request.url }, 'Assinatura Mercado Pago invalida');
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const body = request.body as WebhookBody;

    if (body.type !== 'payment') {
      return reply.status(200).send({ ok: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return reply.status(200).send({ ok: true });
    }

    const payment = new Payment(mercadoPagoClient);
    const result = await payment.get({ id: paymentId });

    if (result.status !== 'approved') {
      return reply.status(200).send({ ok: true });
    }

    const mercadoPagoId = String(result.id);

    const pagamentoOS = await prisma.pagamentoOS.findFirst({
      where: { mercadoPagoId },
    });

    if (!pagamentoOS) {
      return reply.status(200).send({ ok: true });
    }

    await prisma.pagamentoOS.update({
      where: { id: pagamentoOS.id },
      data: { statusPagamento: 'pago', pagoEm: new Date() },
    });

    await prisma.ordemServico.update({
      where: { id: pagamentoOS.ordemServicoId },
      data: { statusPagamento: 'pago' },
    });

    await enqueueCalcularComissao({ pagamentoOSId: pagamentoOS.id });

    return reply.status(200).send({ ok: true });
  });
}
