import type { EventBus } from '../../../shared/domain/EventBus';
import { TECNICO_ATRIBUIDO_OS_EVENT, type TecnicoAtribuidoOS } from '../../../shared/domain/events/TecnicoAtribuidoOS';
import { logger } from '../../../shared/infra/Logger';
import type { NotificacaoTecnicoJobData } from '../../../shared/infra/queues';

/** Funcao que enfileira o job de notificacao ao tecnico (ex.: `enqueueNotificacaoTecnico`). */
export type EnfileirarNotificacaoTecnicoFn = (data: NotificacaoTecnicoJobData) => Promise<void>;

/**
 * Funcao opcional que enfileira o push Expo para o tecnico.
 * Recebe o tecnicoId e o ordemServicoId; a implementacao e responsavel por
 * buscar o token e enfileirar — o listener permanece desacoplado do Prisma.
 */
export type EnfileirarExpoPushTecnicoFn = (tecnicoId: string, ordemServicoId: string) => Promise<void>;

/**
 * Assina o evento `TecnicoAtribuidoOS` no EventBus e enfileira um job na
 * fila `notificacao-tecnico` para avisar o tecnico via WhatsApp.
 *
 * Opcionalmente, quando `enfileirarExpoPush` e fornecida, tambem enfileira
 * uma notificacao push Expo para o tecnico.
 *
 * Nao envia nada de forma sincrona: apenas enfileira, para nao bloquear o
 * use case de atribuicao de tecnico que publicou o evento.
 */
export function registrarNotificarTecnicoAtribuidoListener(
  eventBus: EventBus,
  enfileirarNotificacaoTecnico: EnfileirarNotificacaoTecnicoFn,
  enfileirarExpoPush?: EnfileirarExpoPushTecnicoFn,
): void {
  eventBus.subscribe<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, async (evento) => {
    await enfileirarNotificacaoTecnico({
      ordemServicoId: evento.ordemServicoId,
      tecnicoId: evento.tecnicoId,
      ajudanteId: evento.ajudanteId,
    });

    logger.info(
      { ordemServicoId: evento.ordemServicoId, tecnicoId: evento.tecnicoId, ajudanteId: evento.ajudanteId },
      'Notificacao de atribuicao de tecnico enfileirada',
    );

    if (enfileirarExpoPush) {
      await enfileirarExpoPush(evento.tecnicoId, evento.ordemServicoId);
    }
  });
}
