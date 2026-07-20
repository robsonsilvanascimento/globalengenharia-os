/**
 * Porta do Inbox Pattern: persiste o evento de webhook bruto ANTES de
 * qualquer processamento de negocio, desacoplando o recebimento (responder
 * rapido ao provedor) do processamento (feito pelo worker). Da tambem
 * auditoria/replay dos eventos recebidos.
 */

export type StatusWebhookEvento = 'pendente' | 'processado' | 'falhou' | 'ignorado';

export interface RegistrarWebhookEventoDados {
  provedor: string;
  tipoEvento: string;
  idExterno: string;
  payloadBruto: string;
}

export interface WebhookEventoRegistrado {
  id: string;
  provedor: string;
  tipoEvento: string;
  idExterno: string;
  status: StatusWebhookEvento;
  criadoEm: Date;
}

export interface WebhookEventRepository {
  registrar(dados: RegistrarWebhookEventoDados): Promise<WebhookEventoRegistrado>;
  buscarPorId(id: string): Promise<WebhookEventoRegistrado | null>;
  marcarProcessado(id: string): Promise<void>;
  marcarFalhou(id: string, erro: string): Promise<void>;
  marcarIgnorado(id: string, motivo: string): Promise<void>;
}
