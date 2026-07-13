import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_CRIADA_EVENT, type OSCriada } from '../../../../shared/domain/events/OSCriada';
import { registrarEntregarPdfOSListener } from '../EntregarPdfOSListener';

function publicarEvento(eventBus: EventBus, overrides: Partial<OSCriada> = {}): void {
  const evento: OSCriada = {
    ordemServicoId: 'os-1',
    clienteId: 'cliente-1',
    timestamp: new Date(),
    ...overrides,
  };
  eventBus.publish<OSCriada>(OS_CRIADA_EVENT, evento);
}

describe('registrarEntregarPdfOSListener', () => {
  it('enfileira a entrega de PDF quando o evento OSCriada e publicado', async () => {
    const eventBus = new EventBus();
    const enfileirarEntregaPdfOS = vi.fn().mockResolvedValue(undefined);

    registrarEntregarPdfOSListener(eventBus, enfileirarEntregaPdfOS);
    publicarEvento(eventBus, { ordemServicoId: 'os-42' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(enfileirarEntregaPdfOS).toHaveBeenCalledTimes(1);
    expect(enfileirarEntregaPdfOS).toHaveBeenCalledWith({ ordemServicoId: 'os-42' });
  });
});
