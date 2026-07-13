/**
 * Entidade de dominio pura da NotificacaoEnviada.
 * Registra a tentativa de notificar o cliente via WhatsApp sobre uma
 * mudanca de status de OS. Nao depende de Prisma nem de qualquer detalhe
 * de infraestrutura.
 */

export type StatusEnvioNotificacao = 'pendente' | 'enviada' | 'falhou';

export interface NotificacaoEnviada {
  id: string;
  ordemServicoId: string;
  clienteId: string;
  tipoEvento: string;
  templateUsado?: string | null;
  statusEnvio: StatusEnvioNotificacao;
  tentativas: number;
  criadoEm: Date;
  enviadoEm?: Date | null;
}
