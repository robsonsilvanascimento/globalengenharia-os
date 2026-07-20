import crypto from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const SECRET = 'segredo-webhook-teste';

const { createMock, enqueueProcessarWebhookPagamentoMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  enqueueProcessarWebhookPagamentoMock: vi.fn(),
}));

vi.mock('../../../../../shared/infra/queues', () => ({
  enqueueProcessarWebhookPagamento: enqueueProcessarWebhookPagamentoMock,
}));

import { registerWebhookMercadoPagoRoutes } from '../webhook-routes';

function assinar(rawBody: string, requestId = 'req-1', secret = SECRET): string {
  const ts = String(Math.floor(Date.now() / 1000));
  const dataId = (JSON.parse(rawBody) as { data?: { id?: string } })?.data?.id ?? '';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('webhook-routes (Mercado Pago)', () => {
  let app: FastifyInstance;
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
    createMock.mockReset();
    enqueueProcessarWebhookPagamentoMock.mockReset();

    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'evento-registrado-1',
      criadoEm: new Date(),
      processadoEm: null,
      erro: null,
      status: 'pendente',
      ...data,
    }));

    const fakePrisma = {
      webhookEventoPagamento: { create: createMock },
    } as unknown as PrismaClient;

    app = Fastify();
    registerWebhookMercadoPagoRoutes(app, { prisma: fakePrisma });
    await app.ready();
  });

  afterEach(async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
    await app.close();
  });

  it('rejeita com 400 quando a assinatura e invalida', async () => {
    const payload = { type: 'payment', data: { id: '123' } };
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/mercadopago',
      payload,
      headers: { 'x-signature': 'ts=1,v1=assinatura-forjada', 'x-request-id': 'req-1' },
    });

    expect(response.statusCode).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
    expect(enqueueProcessarWebhookPagamentoMock).not.toHaveBeenCalled();
  });

  it('rejeita quando o header x-signature esta ausente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/mercadopago',
      payload: { type: 'payment', data: { id: '123' } },
    });

    expect(response.statusCode).toBe(400);
  });

  it('responde 200 sem registrar nada para um tipo de evento irrelevante', async () => {
    const rawBody = JSON.stringify({ type: 'merchant_order', data: { id: '123' } });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/mercadopago',
      payload: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-signature': assinar(rawBody),
        'x-request-id': 'req-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createMock).not.toHaveBeenCalled();
    expect(enqueueProcessarWebhookPagamentoMock).not.toHaveBeenCalled();
  });

  it('com assinatura valida e evento de pagamento: registra no Inbox e enfileira o processamento', async () => {
    const rawBody = JSON.stringify({ type: 'payment', data: { id: 'mp-999' } });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/mercadopago',
      payload: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-signature': assinar(rawBody),
        'x-request-id': 'req-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        provedor: 'mercadopago',
        tipoEvento: 'payment',
        idExterno: 'mp-999',
        payloadBruto: rawBody,
      },
    });

    expect(enqueueProcessarWebhookPagamentoMock).toHaveBeenCalledWith({ webhookEventId: 'evento-registrado-1' });
  });

  it('nao processa a logica de pagamento diretamente no handler HTTP (so registra e enfileira)', async () => {
    // Garante que o handler nao tenta consultar pagamentoOS/ordemServico —
    // esse fake de prisma so tem `webhookEventoPagamento`; se o handler
    // tentasse acessar outro modelo, o teste quebraria com TypeError.
    const rawBody = JSON.stringify({ type: 'payment', data: { id: 'mp-1' } });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/mercadopago',
      payload: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-signature': assinar(rawBody),
        'x-request-id': 'req-1',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
