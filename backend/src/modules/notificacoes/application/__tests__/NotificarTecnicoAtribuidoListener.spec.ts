import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { TECNICO_ATRIBUIDO_OS_EVENT, type TecnicoAtribuidoOS } from '../../../../shared/domain/events/TecnicoAtribuidoOS';
import { registrarNotificarTecnicoAtribuidoListener } from '../NotificarTecnicoAtribuidoListener';

function publicarEvento(eventBus: EventBus, overrides: Partial<TecnicoAtribuidoOS> = {}): void {
  const evento: TecnicoAtribuidoOS = {
    ordemServicoId: 'os-1',
    tecnicoId: 'tecnico-1',
    clienteId: 'cliente-1',
    timestamp: new Date(),
    ...overrides,
  };
  eventBus.publish<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, evento);
}

describe('registrarNotificarTecnicoAtribuidoListener', () => {
  it('enfileira a notificacao ao tecnico com ordemServicoId e tecnicoId corretos', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacaoTecnico = vi.fn().mockResolvedValue(undefined);

    registrarNotificarTecnicoAtribuidoListener(eventBus, enfileirarNotificacaoTecnico);
    publicarEvento(eventBus);

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacaoTecnico).toHaveBeenCalledTimes(1);
    expect(enfileirarNotificacaoTecnico).toHaveBeenCalledWith({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
    });
  });

  it('enfileira novamente para uma segunda atribuicao com dados diferentes', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacaoTecnico = vi.fn().mockResolvedValue(undefined);

    registrarNotificarTecnicoAtribuidoListener(eventBus, enfileirarNotificacaoTecnico);
    publicarEvento(eventBus, { ordemServicoId: 'os-2', tecnicoId: 'tecnico-2' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacaoTecnico).toHaveBeenCalledWith({
      ordemServicoId: 'os-2',
      tecnicoId: 'tecnico-2',
    });
  });

  it('repassa ajudanteId do evento para o job enfileirado quando presente', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacaoTecnico = vi.fn().mockResolvedValue(undefined);

    registrarNotificarTecnicoAtribuidoListener(eventBus, enfileirarNotificacaoTecnico);
    publicarEvento(eventBus, { ordemServicoId: 'os-3', tecnicoId: 'tecnico-3', ajudanteId: 'ajudante-1' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacaoTecnico).toHaveBeenCalledWith({
      ordemServicoId: 'os-3',
      tecnicoId: 'tecnico-3',
      ajudanteId: 'ajudante-1',
    });
  });
});
