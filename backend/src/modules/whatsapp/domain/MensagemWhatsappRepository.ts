import type { DirecaoMensagemWhatsapp, MensagemWhatsapp } from './MensagemWhatsapp';

/** Dados necessarios para criar uma MensagemWhatsapp. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarMensagemWhatsappDados {
  conversaId: string;
  direcao: DirecaoMensagemWhatsapp;
  tipoConteudo: string;
  conteudo: string;
  whatsappMessageId: string;
  statusEntrega?: string;
}

/**
 * Contrato de persistencia para MensagemWhatsapp. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 */
export interface MensagemWhatsappRepository {
  create(dados: CriarMensagemWhatsappDados): Promise<MensagemWhatsapp>;
}
