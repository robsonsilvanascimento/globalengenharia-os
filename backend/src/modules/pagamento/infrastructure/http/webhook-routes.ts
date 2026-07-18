import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Payment } from 'mercadopago';
import type { PrismaClient } from '@prisma/client';
import { mercadoPagoClient } from '../mercadopago/MercadoPagoService';
import { enqueueCalcularComissao } from '../queues/comissao-queue';
import { enqueueEntregaRecibo } from '../../../../shared/infra/queues';
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

  const bufferEsperado = Buffer.from(expected);
  const bufferRecebido = Buffer.from(v1);

  if (bufferRecebido.length !== bufferEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferRecebido, bufferEsperado);
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Corpo bruto (string) do request, preservado para validacao de assinatura HMAC. */
    rawBody?: string;
  }
}

export function registerWebhookMercadoPagoRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
): void {
  app.register(async (instance) => {
    // Content-type parser proprio, escopado a este plugin encapsulado (nao
    // afeta o parsing JSON do resto da aplicacao): preserva o body bruto
    // exatamente como recebido, necessario porque a assinatura HMAC do
    // Mercado Pago e calculada sobre os bytes originais — reconstruir via
    // JSON.stringify(request.body) (o fallback que existia antes) diverge
    // sempre que a serializacao do Fastify nao bate byte a byte com o
    // payload original (espacamento, ordem de chaves, escaping), rejeitando
    // webhooks legitimos silenciosamente.
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (request, body, done) => {
        request.rawBody = body as string;

        if (!body) {
          done(null, {});
          return;
        }

        try {
          done(null, JSON.parse(body as string));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

    instance.post('/webhooks/mercadopago', async (request, reply) => {
      const rawBody = request.rawBody ?? '';

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

      if (pagamentoOS.statusPagamento === 'pago') {
        // Idempotencia: o Mercado Pago pode reentregar o mesmo webhook (ex.:
        // nossa resposta anterior nao chegou a tempo). Sem essa checagem, o
        // pagamento ja confirmado dispara de novo o calculo de comissao e o
        // envio do recibo ao cliente.
        return reply.status(200).send({ ok: true });
      }

      if (pagamentoOS.statusPagamento === 'cancelado') {
        // Um admin pode ter cancelado este pagamento manualmente apos o Pix
        // ter sido gerado (ver rota .../cancelar). Se o cliente pagar mesmo
        // assim e este webhook chegar depois, nao reverte a decisao do admin
        // silenciosamente — fica para revisao manual.
        logger.warn(
          { pagamentoOSId: pagamentoOS.id },
          'Webhook de pagamento aprovado recebido para um PagamentoOS ja cancelado - ignorado, requer revisao manual',
        );
        return reply.status(200).send({ ok: true });
      }

      const valorPago = Number(result.transaction_amount ?? 0);
      const diferenca = Math.abs(valorPago - pagamentoOS.valor);

      if (diferenca > 0.01) {
        logger.error(
          { pagamentoOSId: pagamentoOS.id, valorEsperado: pagamentoOS.valor, valorPago },
          'Valor pago no Mercado Pago diverge do valor cobrado - pagamento NAO confirmado automaticamente, requer revisao manual',
        );
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
      await enqueueEntregaRecibo({ pagamentoOSId: pagamentoOS.id });

      return reply.status(200).send({ ok: true });
    });
  });
}
