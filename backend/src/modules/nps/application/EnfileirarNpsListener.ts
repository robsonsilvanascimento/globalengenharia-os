import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import type { NpsJobData } from '../infrastructure/queues/nps-queue';

export type EnfileirarNpsFn = (data: NpsJobData) => Promise<void>;

export function registrarEnfileirarNpsListener(
  eventBus: EventBus,
  enfileirarNps: EnfileirarNpsFn,
): void {
  eventBus.subscribe<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, async (evento) => {
    if (evento.statusNovo !== 'concluida') return;
    if (!evento.clienteId) return;
    await enfileirarNps({
      ordemServicoId: evento.ordemServicoId,
      clienteId: evento.clienteId,
    });
  });
}
