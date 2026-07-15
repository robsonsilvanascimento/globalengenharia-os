import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import { logger } from '../../../shared/infra/Logger';
import type { PixWhatsappJobData } from '../../../shared/infra/queues';

/** Funcao que enfileira o job de geracao/envio de Pix (ex.: `enqueuePixWhatsapp`). */
export type EnfileirarPixWhatsappFn = (data: PixWhatsappJobData) => Promise<void>;

/**
 * Assina o evento `OSStatusAlterado` no EventBus e, quando o novo status for
 * `concluida`, enfileira um job na fila `pix-whatsapp` para que o worker gere
 * o Pix (Mercado Pago) da OS e envie o codigo ao cliente via WhatsApp.
 *
 * Nao faz nada de forma sincrona: apenas enfileira, para nao bloquear o use
 * case de mudanca de status que publicou o evento. A validacao de
 * `valorCobrado` e a geracao/envio efetivos do Pix sao feitos pelo worker
 * (ver `infrastructure/queues/pix-whatsapp-worker.ts`), que tambem decide
 * ignorar OS ja pagas.
 */
export function registrarGerarPixAoConcluirOSListener(
  eventBus: EventBus,
  enfileirarPixWhatsapp: EnfileirarPixWhatsappFn,
): void {
  eventBus.subscribe<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, async (evento) => {
    if (evento.statusNovo !== 'concluida') {
      return;
    }

    await enfileirarPixWhatsapp({ ordemServicoId: evento.ordemServicoId });

    logger.info(
      { ordemServicoId: evento.ordemServicoId, clienteId: evento.clienteId },
      'Geracao de Pix e envio via WhatsApp enfileirados apos conclusao da OS',
    );
  });
}
