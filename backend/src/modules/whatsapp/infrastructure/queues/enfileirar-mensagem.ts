import { prisma } from '../../../../shared/infra/PrismaClient';
import { logger } from '../../../../shared/infra/Logger';
import { enqueueWhatsappConversaJob } from '../../../../shared/infra/queues';

/** Mensagem recebida do webhook da Meta, ja normalizada. */
export interface MensagemRecebidaWebhook {
  telefone: string;
  whatsappMessageId: string;
  tipo: string;
  conteudo: string;
}

/**
 * Verifica idempotencia (mensagem ja registrada pelo `whatsappMessageId`) e,
 * caso seja inedita, enfileira o processamento na fila `whatsapp-conversa`.
 *
 * A deduplicacao por telefone (para nao processar mensagens do mesmo cliente
 * em paralelo) e feita pelo `jobId` deterministico usado em
 * `enqueueWhatsappConversaJob` (ver `shared/infra/queues/index.ts`).
 */
export async function enfileirarMensagemRecebida(
  mensagem: MensagemRecebidaWebhook,
): Promise<void> {
  const existente = await prisma.mensagemWhatsapp.findUnique({
    where: { whatsappMessageId: mensagem.whatsappMessageId },
  });

  if (existente) {
    logger.info(
      { whatsappMessageId: mensagem.whatsappMessageId },
      'Mensagem do WhatsApp ja processada anteriormente (idempotencia) - descartando',
    );
    return;
  }

  await enqueueWhatsappConversaJob(mensagem.telefone, {
    telefoneCliente: mensagem.telefone,
    waMessageId: mensagem.whatsappMessageId,
    recebidoEm: new Date().toISOString(),
    tipo: mensagem.tipo,
    conteudo: mensagem.conteudo,
  });
}
