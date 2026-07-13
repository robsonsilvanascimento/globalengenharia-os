import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_CRIADA_EVENT, type OSCriada } from '../../../shared/domain/events/OSCriada';
import { logger } from '../../../shared/infra/Logger';
import type { EntregaPdfOSJobData } from '../../../shared/infra/queues';

/** Funcao que enfileira o job de entrega de PDF (ex.: `enqueueEntregaPdfOS`). */
export type EnfileirarEntregaPdfOSFn = (data: EntregaPdfOSJobData) => Promise<void>;

/**
 * Assina o evento `OSCriada` no EventBus e enfileira um job na fila
 * `entrega-pdf-os` para que o worker gere o PDF da OS e o entregue ao
 * cliente via WhatsApp (e e-mail, quando disponivel).
 *
 * Nao faz nada de forma sincrona: apenas enfileira, para nao bloquear o use
 * case de criacao de OS que publicou o evento. A geracao/entrega efetiva do
 * PDF e feita pelo worker (ver `infrastructure/queues/entrega-pdf-worker.ts`).
 */
export function registrarEntregarPdfOSListener(
  eventBus: EventBus,
  enfileirarEntregaPdfOS: EnfileirarEntregaPdfOSFn,
): void {
  eventBus.subscribe<OSCriada>(OS_CRIADA_EVENT, async (evento) => {
    await enfileirarEntregaPdfOS({ ordemServicoId: evento.ordemServicoId });

    logger.info(
      { ordemServicoId: evento.ordemServicoId, clienteId: evento.clienteId },
      'Entrega de PDF da OS enfileirada',
    );
  });
}
