/** Direcao da mensagem em relacao ao cliente. Espelha o enum DirecaoMensagem do Prisma. */
export type DirecaoMensagemWhatsapp = 'entrada' | 'saida';

/** Entidade de dominio MensagemWhatsapp. Nao carrega nenhum detalhe de persistencia. */
export interface MensagemWhatsapp {
  id: string;
  conversaId: string;
  direcao: DirecaoMensagemWhatsapp;
  tipoConteudo: string;
  conteudo: string;
  whatsappMessageId: string;
  statusEntrega?: string;
  criadoEm: Date;
}
