/** Status possiveis de uma SolicitacaoAtendimento. Espelha o enum StatusSolicitacaoAtendimento do Prisma. */
export type StatusSolicitacaoAtendimento = 'pendente' | 'respondida';

/**
 * Entidade de dominio SolicitacaoAtendimento. Representa uma pergunta do
 * cliente que o bot do WhatsApp nao soube responder e escalou para
 * atendimento humano. Nao carrega nenhum detalhe de persistencia.
 */
export interface SolicitacaoAtendimento {
  id: string;
  clienteId: string;
  conversaId?: string | null;
  mensagemCliente: string;
  status: StatusSolicitacaoAtendimento;
  respostaTexto?: string | null;
  respondidoPorUsuarioId?: string | null;
  salvarComoFaq: boolean;
  criadoEm: Date;
  respondidoEm?: Date | null;
}
