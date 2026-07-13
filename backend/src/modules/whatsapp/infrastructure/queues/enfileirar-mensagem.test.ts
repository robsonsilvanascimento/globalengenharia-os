import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findUniqueMock, enqueueWhatsappConversaJobMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  enqueueWhatsappConversaJobMock: vi.fn(),
}));

vi.mock('../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    mensagemWhatsapp: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('../../../../shared/infra/queues', () => ({
  enqueueWhatsappConversaJob: enqueueWhatsappConversaJobMock,
}));

import { enfileirarMensagemRecebida } from './enfileirar-mensagem';

describe('enfileirarMensagemRecebida', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    enqueueWhatsappConversaJobMock.mockReset();
  });

  it('enfileira a mensagem quando o whatsappMessageId ainda nao existe', async () => {
    findUniqueMock.mockResolvedValue(null);

    await enfileirarMensagemRecebida({
      telefone: '5511999999999',
      whatsappMessageId: 'wamid.novo-1',
      tipo: 'text',
      conteudo: 'Ola',
    });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { whatsappMessageId: 'wamid.novo-1' },
    });
    expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledTimes(1);
    expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledWith(
      '5511999999999',
      expect.objectContaining({
        telefoneCliente: '5511999999999',
        waMessageId: 'wamid.novo-1',
      }),
    );
  });

  it('descarta e nao enfileira novamente quando o whatsappMessageId ja existe (idempotencia)', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'msg-1',
      whatsappMessageId: 'wamid.repetido-1',
    });

    await enfileirarMensagemRecebida({
      telefone: '5511999999999',
      whatsappMessageId: 'wamid.repetido-1',
      tipo: 'text',
      conteudo: 'Ola de novo',
    });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { whatsappMessageId: 'wamid.repetido-1' },
    });
    expect(enqueueWhatsappConversaJobMock).not.toHaveBeenCalled();
  });
});
