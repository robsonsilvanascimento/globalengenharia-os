import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../../shared/domain/events/OSStatusAlterado';
import { registrarGerarPixAoConcluirOSListener } from '../GerarPixAoConcluirOSListener';

function publicarEvento(eventBus: EventBus, overrides: Partial<OSStatusAlterado> = {}): void {
  const evento: OSStatusAlterado = {
    ordemServicoId: 'os-1',
    statusAnterior: 'em_andamento',
    statusNovo: 'concluida',
    clienteId: 'cliente-1',
    alteradoPor: 'tecnico-1',
    alteradoPorBot: false,
    timestamp: new Date(),
    ...overrides,
  };
  eventBus.publish<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, evento);
}

describe('registrarGerarPixAoConcluirOSListener', () => {
  it('enfileira o job de Pix/WhatsApp quando a OS e concluida', async () => {
    const eventBus = new EventBus();
    const enfileirarPixWhatsapp = vi.fn().mockResolvedValue(undefined);

    registrarGerarPixAoConcluirOSListener(eventBus, enfileirarPixWhatsapp);
    publicarEvento(eventBus, { statusNovo: 'concluida' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarPixWhatsapp).toHaveBeenCalledTimes(1);
    expect(enfileirarPixWhatsapp).toHaveBeenCalledWith({ ordemServicoId: 'os-1' });
  });

  it('nao enfileira nada quando o novo status nao e concluida', async () => {
    const eventBus = new EventBus();
    const enfileirarPixWhatsapp = vi.fn().mockResolvedValue(undefined);

    registrarGerarPixAoConcluirOSListener(eventBus, enfileirarPixWhatsapp);
    publicarEvento(eventBus, { statusNovo: 'cancelada' });
    publicarEvento(eventBus, { statusNovo: 'em_andamento' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarPixWhatsapp).not.toHaveBeenCalled();
  });
});
