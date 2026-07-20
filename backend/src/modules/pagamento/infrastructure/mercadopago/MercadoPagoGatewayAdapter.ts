import crypto from 'node:crypto';
import type {
  CobrancaPixCriada,
  CriarCobrancaPixInput,
  EventoWebhookPagamento,
  PagamentoExterno,
  PaymentGateway,
  StatusPagamentoExterno,
} from '../../domain/PaymentGateway';
import {
  cancelarPixOrdemServico,
  consultarPagamentoPorId,
  gerarPixOrdemServico,
} from './MercadoPagoService';

interface WebhookBodyMercadoPago {
  type?: string;
  data?: { id?: string };
}

/** Traduz o status bruto do Mercado Pago para o vocabulario interno do dominio. */
function mapearStatus(statusBruto: string | undefined): StatusPagamentoExterno {
  switch (statusBruto) {
    case 'approved':
      return 'aprovado';
    case 'rejected':
      return 'rejeitado';
    case 'cancelled':
      return 'cancelado';
    case 'pending':
    case 'authorized':
    case 'in_process':
    case 'in_mediation':
      return 'pendente';
    default:
      return 'outro';
  }
}

/**
 * Adapter que implementa `PaymentGateway` traduzindo de/para o Mercado Pago.
 * E a UNICA classe do sistema que conhece o formato do SDK/webhook do
 * Mercado Pago — domain e application nunca importam nada daqui.
 */
export class MercadoPagoGatewayAdapter implements PaymentGateway {
  async criarCobrancaPix(input: CriarCobrancaPixInput): Promise<CobrancaPixCriada> {
    const { mercadoPagoId, qrCode, copiaECola } = await gerarPixOrdemServico({
      ordemServicoId: input.referenciaExterna,
      valor: input.valor,
      clienteNome: input.clienteNome,
      clienteEmail: input.clienteEmail,
    });
    return { idExterno: mercadoPagoId, qrCode, copiaECola };
  }

  async cancelarCobranca(idExterno: string): Promise<void> {
    await cancelarPixOrdemServico(idExterno);
  }

  async consultarPagamento(idExterno: string): Promise<PagamentoExterno | null> {
    // Um pagamento inexistente faz o SDK do Mercado Pago rejeitar a chamada
    // (o erro propaga para o worker decidir sobre retry) — nao ha um "id
    // vazio" de retorno normal a tratar aqui.
    const resultado = await consultarPagamentoPorId(idExterno);
    return {
      idExterno: resultado.id,
      status: mapearStatus(resultado.status),
      valor: resultado.valor,
      referenciaExterna: resultado.referenciaExterna,
    };
  }

  /**
   * Verifica a assinatura HMAC-SHA256 do webhook, no formato descrito na doc
   * do Mercado Pago: header `x-signature` = "ts=<epoch>,v1=<hmac hex>",
   * calculado sobre o manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
   * O `data.id` entra no manifest em MINUSCULAS — a doc do Mercado Pago e um
   * relato da propria comunidade (mercadopago/sdk-nodejs) confirmam que IDs
   * alfanumericos (ex.: "ORD01JQ4S...") sao normalizados para lowercase antes
   * do calculo do HMAC, mesmo que o `id` "de verdade" (usado em chamadas de
   * API e no Inbox) preserve o case original.
   * Usa `timingSafeEqual` para nao vazar a assinatura por timing attack.
   */
  validarAssinaturaWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return false;

    const xSignature = headers['x-signature'] as string | undefined;
    const requestId = headers['x-request-id'] as string | undefined;
    if (!xSignature) return false;

    // O header vem no formato "ts=<epoch>,v1=<hash>" (separado por VIRGULA,
    // conforme a documentacao do Mercado Pago) — nao por "&". Com o
    // separador errado, `parts['v1']` ficaria sempre undefined e nenhum
    // webhook legitimo passaria na validacao.
    const parts = Object.fromEntries(xSignature.split(',').map((p) => p.split('='))) as Record<string, string>;
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    let dataId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as WebhookBodyMercadoPago;
      dataId = parsed?.data?.id;
    } catch {
      return false;
    }

    const manifest = `id:${dataId?.toLowerCase() ?? ''};request-id:${requestId ?? ''};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    const bufferEsperado = Buffer.from(expected);
    const bufferRecebido = Buffer.from(v1);
    if (bufferRecebido.length !== bufferEsperado.length) return false;

    return crypto.timingSafeEqual(bufferRecebido, bufferEsperado);
  }

  extrairEventoWebhook(rawBody: string): EventoWebhookPagamento | null {
    let parsed: WebhookBodyMercadoPago;
    try {
      parsed = JSON.parse(rawBody) as WebhookBodyMercadoPago;
    } catch {
      return null;
    }

    // So o tipo 'payment' interessa ao sistema hoje (outros tipos de evento
    // do Mercado Pago, ex. 'merchant_order', sao ignorados silenciosamente).
    if (parsed.type !== 'payment') return null;

    const idExterno = parsed.data?.id;
    if (!idExterno) return null;

    return { tipo: parsed.type, idExterno };
  }
}
