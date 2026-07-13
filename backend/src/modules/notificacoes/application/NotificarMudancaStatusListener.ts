import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import { logger } from '../../../shared/infra/Logger';
import type { NotificacaoWhatsappJobData } from '../../../shared/infra/queues';
import { STATUS_PARA_TEMPLATE } from './StatusParaTemplate';

/** Funcao que enfileira o job de notificacao (ex.: `enqueueNotificacaoWhatsapp`). */
export type EnfileirarNotificacaoFn = (data: NotificacaoWhatsappJobData) => Promise<void>;

/**
 * Assina o evento `OSStatusAlterado` no EventBus e, quando o novo status
 * possui um template de WhatsApp aprovado mapeado em `STATUS_PARA_TEMPLATE`,
 * enfileira um job na fila `notificacoes-whatsapp`.
 *
 * Nao envia nada de forma sincrona: apenas enfileira, para nao bloquear o
 * use case de mudanca de status que publicou o evento. O envio de fato e
 * feito pelo worker (ver `infrastructure/queues/notificacao-worker.ts`).
 */
export function registrarNotificarMudancaStatusListener(
  eventBus: EventBus,
  enfileirarNotificacao: EnfileirarNotificacaoFn,
): void {
  eventBus.subscribe<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, async (evento) => {
    const templateNome = STATUS_PARA_TEMPLATE[evento.statusNovo];

    if (!templateNome) {
      logger.debug(
        { ordemServicoId: evento.ordemServicoId, statusNovo: evento.statusNovo },
        'Nenhum template de notificacao mapeado para este status - notificacao nao enfileirada',
      );
      return;
    }

    await enfileirarNotificacao({
      ordemServicoId: evento.ordemServicoId,
      clienteId: evento.clienteId,
      statusNovo: evento.statusNovo,
      templateNome,
    });

    logger.info(
      { ordemServicoId: evento.ordemServicoId, statusNovo: evento.statusNovo, templateNome },
      'Notificacao de mudanca de status enfileirada',
    );
  });
}
