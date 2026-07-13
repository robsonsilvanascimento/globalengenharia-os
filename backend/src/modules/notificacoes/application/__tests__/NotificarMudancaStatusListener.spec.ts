import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../../shared/domain/events/OSStatusAlterado';
import { registrarNotificarMudancaStatusListener } from '../NotificarMudancaStatusListener';

function publicarEvento(eventBus: EventBus, overrides: Partial<OSStatusAlterado> = {}): void {
  const evento: OSStatusAlterado = {
    ordemServicoId: 'os-1',
    statusAnterior: 'atribuida',
    statusNovo: 'em_andamento',
    clienteId: 'cliente-1',
    alteradoPor: 'tecnico-1',
    alteradoPorBot: false,
    timestamp: new Date(),
    ...overrides,
  };
  eventBus.publish<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, evento);
}

describe('registrarNotificarMudancaStatusListener', () => {
  it('enfileira a notificacao quando o novo status possui template mapeado', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacao = vi.fn().mockResolvedValue(undefined);

    registrarNotificarMudancaStatusListener(eventBus, enfileirarNotificacao);
    publicarEvento(eventBus, { statusNovo: 'em_andamento' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacao).toHaveBeenCalledTimes(1);
    expect(enfileirarNotificacao).toHaveBeenCalledWith({
      ordemServicoId: 'os-1',
      clienteId: 'cliente-1',
      statusNovo: 'em_andamento',
      templateNome: 'status_em_andamento',
    });
  });

  it('mapeia corretamente status concluida e cancelada para seus templates', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacao = vi.fn().mockResolvedValue(undefined);

    registrarNotificarMudancaStatusListener(eventBus, enfileirarNotificacao);
    publicarEvento(eventBus, { ordemServicoId: 'os-2', statusNovo: 'concluida' });
    publicarEvento(eventBus, { ordemServicoId: 'os-3', statusNovo: 'cancelada' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacao).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-2', templateNome: 'status_concluida' }),
    );
    expect(enfileirarNotificacao).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-3', templateNome: 'status_cancelada' }),
    );
  });

  it('nao enfileira nada quando o novo status nao possui template mapeado', async () => {
    const eventBus = new EventBus();
    const enfileirarNotificacao = vi.fn().mockResolvedValue(undefined);

    registrarNotificarMudancaStatusListener(eventBus, enfileirarNotificacao);
    publicarEvento(eventBus, { statusNovo: 'triagem' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarNotificacao).not.toHaveBeenCalled();
  });
});
