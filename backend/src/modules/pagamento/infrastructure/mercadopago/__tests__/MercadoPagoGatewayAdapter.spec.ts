import crypto from 'node:crypto';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { MercadoPagoGatewayAdapter } from '../MercadoPagoGatewayAdapter';

const SECRET = 'segredo-de-teste';

function assinar(
  rawBody: string,
  requestId: string,
  secret = SECRET,
  lowercaseId = true,
): { header: string; ts: string } {
  const ts = String(Math.floor(Date.now() / 1000));
  const rawDataId = (JSON.parse(rawBody) as { data?: { id?: string } })?.data?.id ?? '';
  const dataId = lowercaseId ? rawDataId.toLowerCase() : rawDataId;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return { header: `ts=${ts},v1=${v1}`, ts };
}

describe('MercadoPagoGatewayAdapter', () => {
  let adapter: MercadoPagoGatewayAdapter;
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
    adapter = new MercadoPagoGatewayAdapter();
  });

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
  });

  describe('validarAssinaturaWebhook', () => {
    const rawBody = JSON.stringify({ type: 'payment', data: { id: '123456789' } });

    it('aceita uma assinatura valida', () => {
      const { header } = assinar(rawBody, 'req-1');
      const valido = adapter.validarAssinaturaWebhook(rawBody, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(true);
    });

    it('rejeita quando o secret nao esta configurado', () => {
      delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
      const { header } = assinar(rawBody, 'req-1');
      const valido = adapter.validarAssinaturaWebhook(rawBody, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });

    it('rejeita quando o header x-signature esta ausente', () => {
      const valido = adapter.validarAssinaturaWebhook(rawBody, { 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });

    it('rejeita uma assinatura calculada com outro segredo', () => {
      const { header } = assinar(rawBody, 'req-1', 'segredo-errado');
      const valido = adapter.validarAssinaturaWebhook(rawBody, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });

    it('rejeita quando o corpo foi alterado apos a assinatura', () => {
      const { header } = assinar(rawBody, 'req-1');
      const corpoAlterado = JSON.stringify({ type: 'payment', data: { id: '999999999' } });
      const valido = adapter.validarAssinaturaWebhook(corpoAlterado, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });

    it('rejeita um x-signature malformado (sem ts/v1)', () => {
      const valido = adapter.validarAssinaturaWebhook(rawBody, { 'x-signature': 'formato=invalido', 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });

    it('aceita uma assinatura valida quando data.id tem letras maiusculas (normalizado para minusculas no manifest, conforme doc do Mercado Pago)', () => {
      const rawBodyMaiusculo = JSON.stringify({ type: 'payment', data: { id: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3' } });
      const { header } = assinar(rawBodyMaiusculo, 'req-1');
      const valido = adapter.validarAssinaturaWebhook(rawBodyMaiusculo, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(true);
    });

    it('rejeita quando a assinatura foi calculada com o id em maiusculas sem normalizar (prova que a normalizacao e necessaria)', () => {
      const rawBodyMaiusculo = JSON.stringify({ type: 'payment', data: { id: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3' } });
      const { header } = assinar(rawBodyMaiusculo, 'req-1', SECRET, false);
      const valido = adapter.validarAssinaturaWebhook(rawBodyMaiusculo, { 'x-signature': header, 'x-request-id': 'req-1' });
      expect(valido).toBe(false);
    });
  });

  describe('extrairEventoWebhook', () => {
    it('extrai tipo e id externo de um evento de pagamento', () => {
      const evento = adapter.extrairEventoWebhook(JSON.stringify({ type: 'payment', data: { id: '123' } }));
      expect(evento).toEqual({ tipo: 'payment', idExterno: '123' });
    });

    it('retorna null para tipos de evento diferentes de payment', () => {
      const evento = adapter.extrairEventoWebhook(JSON.stringify({ type: 'merchant_order', data: { id: '123' } }));
      expect(evento).toBeNull();
    });

    it('retorna null quando falta o id do pagamento', () => {
      const evento = adapter.extrairEventoWebhook(JSON.stringify({ type: 'payment', data: {} }));
      expect(evento).toBeNull();
    });

    it('retorna null para JSON invalido', () => {
      const evento = adapter.extrairEventoWebhook('{nao-e-json');
      expect(evento).toBeNull();
    });
  });
});
