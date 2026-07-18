import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findUniquePecaMock, findManyUsuarioMock, enqueueExpoPushMock } = vi.hoisted(() => ({
  findUniquePecaMock: vi.fn(),
  findManyUsuarioMock: vi.fn(),
  enqueueExpoPushMock: vi.fn(),
}));

vi.mock('../../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    peca: { findUnique: findUniquePecaMock },
    usuario: { findMany: findManyUsuarioMock },
  },
}));

vi.mock('../../../../notificacoes/infrastructure/queues/expo-push-queue', () => ({
  enqueueExpoPush: enqueueExpoPushMock,
}));

import { processarAlertaEstoque } from '../alerta-estoque-worker';

function criarPecaFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'peca-1',
    codigo: 'DJ-40A',
    nome: 'Disjuntor 40A',
    unidade: 'un',
    estoqueAtual: 2,
    estoqueMinimo: 5,
    ativo: true,
    ...overrides,
  };
}

describe('processarAlertaEstoque', () => {
  beforeEach(() => {
    findUniquePecaMock.mockReset();
    findManyUsuarioMock.mockReset();
    enqueueExpoPushMock.mockReset();
  });

  it('notifica todos os admins com token quando a peca esta abaixo do minimo', async () => {
    findUniquePecaMock.mockResolvedValue(criarPecaFake());
    findManyUsuarioMock.mockResolvedValue([
      { id: 'admin-1', expoPushToken: 'ExponentPushToken[aaa]' },
      { id: 'admin-2', expoPushToken: 'ExponentPushToken[bbb]' },
    ]);

    await processarAlertaEstoque('peca-1');

    expect(enqueueExpoPushMock).toHaveBeenCalledTimes(2);
    expect(enqueueExpoPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expoPushToken: 'ExponentPushToken[aaa]',
        titulo: 'Estoque baixo',
        corpo: expect.stringContaining('Disjuntor 40A'),
        data: expect.objectContaining({ tipo: 'alerta_estoque', pecaId: 'peca-1' }),
      }),
    );
  });

  it('nao notifica quando a peca ja foi reposta (estoque acima do minimo)', async () => {
    findUniquePecaMock.mockResolvedValue(criarPecaFake({ estoqueAtual: 10, estoqueMinimo: 5 }));

    await processarAlertaEstoque('peca-1');

    expect(findManyUsuarioMock).not.toHaveBeenCalled();
    expect(enqueueExpoPushMock).not.toHaveBeenCalled();
  });

  it('nao notifica quando a peca esta inativa', async () => {
    findUniquePecaMock.mockResolvedValue(criarPecaFake({ ativo: false }));

    await processarAlertaEstoque('peca-1');

    expect(enqueueExpoPushMock).not.toHaveBeenCalled();
  });

  it('nao faz nada quando a peca nao existe', async () => {
    findUniquePecaMock.mockResolvedValue(null);

    await processarAlertaEstoque('peca-inexistente');

    expect(findManyUsuarioMock).not.toHaveBeenCalled();
    expect(enqueueExpoPushMock).not.toHaveBeenCalled();
  });

  it('processa sem erro quando nao ha nenhum admin com app instalado', async () => {
    findUniquePecaMock.mockResolvedValue(criarPecaFake());
    findManyUsuarioMock.mockResolvedValue([]);

    await processarAlertaEstoque('peca-1');

    expect(enqueueExpoPushMock).not.toHaveBeenCalled();
  });

  it('alerta tambem quando o estoque bate exatamente no minimo', async () => {
    findUniquePecaMock.mockResolvedValue(criarPecaFake({ estoqueAtual: 5, estoqueMinimo: 5 }));
    findManyUsuarioMock.mockResolvedValue([{ id: 'admin-1', expoPushToken: 'ExponentPushToken[aaa]' }]);

    await processarAlertaEstoque('peca-1');

    expect(enqueueExpoPushMock).toHaveBeenCalledTimes(1);
  });
});
