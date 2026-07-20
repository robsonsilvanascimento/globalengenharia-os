/**
 * Porta de saida para o provedor de cobranca Pix. A camada de aplicacao
 * (use cases) so conhece esta interface — nunca o SDK ou o formato de dados
 * de um provedor especifico (Mercado Pago, etc.). Trocar de provedor exige
 * apenas um novo adapter em `infrastructure/`, sem tocar em domain/application.
 */

export interface CriarCobrancaPixInput {
  /** Referencia interna (id da OS) usada para conciliar a cobranca depois. */
  referenciaExterna: string;
  valor: number;
  clienteNome: string;
  clienteEmail?: string;
}

export interface CobrancaPixCriada {
  /** Id da cobranca no provedor externo. */
  idExterno: string;
  qrCode: string;
  copiaECola: string;
}

export type StatusPagamentoExterno = 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado' | 'outro';

export interface PagamentoExterno {
  idExterno: string;
  status: StatusPagamentoExterno;
  valor: number;
  /** Referencia interna informada na criacao (id da OS), quando o provedor a devolve. */
  referenciaExterna: string | null;
}

/** Evento de webhook ja traduzido para o formato interno (independente do provedor). */
export interface EventoWebhookPagamento {
  tipo: string;
  idExterno: string;
}

export interface PaymentGateway {
  criarCobrancaPix(input: CriarCobrancaPixInput): Promise<CobrancaPixCriada>;

  /** Cancela uma cobranca ainda pendente. Deve rejeitar se o provedor recusar (ex.: ja paga). */
  cancelarCobranca(idExterno: string): Promise<void>;

  /** Busca o estado atual do pagamento direto no provedor — nunca confiar cegamente no payload do webhook. */
  consultarPagamento(idExterno: string): Promise<PagamentoExterno | null>;

  /** Valida a assinatura/autenticidade de um webhook recebido. */
  validarAssinaturaWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean;

  /** Traduz o payload bruto do webhook para o formato interno. Retorna `null` se o evento nao for relevante (tipo desconhecido/ignorado) ou malformado. */
  extrairEventoWebhook(rawBody: string): EventoWebhookPagamento | null;
}
