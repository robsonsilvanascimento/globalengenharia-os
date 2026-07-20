import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { logger } from '../../../../shared/infra/Logger';
import { enqueueProcessarWebhookPagamento } from '../../../../shared/infra/queues';
import { MercadoPagoGatewayAdapter } from '../mercadopago/MercadoPagoGatewayAdapter';
import { PrismaWebhookEventRepository } from '../PrismaWebhookEventRepository';

declare module 'fastify' {
  interface FastifyRequest {
    /** Corpo bruto (string) do request, preservado para validacao de assinatura HMAC. */
    rawBody?: string;
  }
}

/**
 * Rota do webhook do Mercado Pago. Deliberadamente enxuta: so valida a
 * assinatura, traduz e registra o evento no Inbox
 * (`webhook_eventos_pagamento`) e enfileira o processamento — responde 200
 * ao provedor o mais rapido possivel, sem esperar nenhuma logica de negocio.
 * Toda a confirmacao de pagamento (reconsulta no gateway, idempotencia,
 * comissao, recibo) roda no worker via `ProcessarWebhookPagamentoUseCase`
 * (ver `infrastructure/queues/pagamento-webhook-worker.ts`).
 */
export function registerWebhookMercadoPagoRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
): void {
  const gateway = new MercadoPagoGatewayAdapter();
  const webhookEventRepository = new PrismaWebhookEventRepository(prisma);

  app.register(async (instance) => {
    // Content-type parser proprio, escopado a este plugin encapsulado (nao
    // afeta o parsing JSON do resto da aplicacao): preserva o body bruto
    // exatamente como recebido, necessario porque a assinatura HMAC do
    // Mercado Pago e calculada sobre os bytes originais — reconstruir via
    // JSON.stringify(request.body) diverge sempre que a serializacao do
    // Fastify nao bate byte a byte com o payload original (espacamento,
    // ordem de chaves, escaping), rejeitando webhooks legitimos
    // silenciosamente.
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

      const assinaturaValida = gateway.validarAssinaturaWebhook(
        rawBody,
        request.headers as Record<string, string | string[] | undefined>,
      );
      if (!assinaturaValida) {
        logger.warn({ url: request.url }, 'Assinatura Mercado Pago invalida');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      const evento = gateway.extrairEventoWebhook(rawBody);
      if (!evento) {
        // Tipo de evento nao relevante (ex.: diferente de 'payment') ou
        // payload sem id — nada a fazer, mas confirma o recebimento.
        return reply.status(200).send({ ok: true });
      }

      const registrado = await webhookEventRepository.registrar({
        provedor: 'mercadopago',
        tipoEvento: evento.tipo,
        idExterno: evento.idExterno,
        payloadBruto: rawBody,
      });

      await enqueueProcessarWebhookPagamento({ webhookEventId: registrado.id });

      return reply.status(200).send({ ok: true });
    });
  });
}
