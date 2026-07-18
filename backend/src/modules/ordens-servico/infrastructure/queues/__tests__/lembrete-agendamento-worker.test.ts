import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findManyMock, updateMock, enviarTemplateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
  enviarTemplateMock: vi.fn(),
}));

// Evita instanciar Queue/Worker (e conectar ao Redis) ao importar o modulo.
vi.mock('bullmq', () => ({ Queue: vi.fn(), Worker: vi.fn() }));
vi.mock('../../../../../shared/infra/RedisConnection', () => ({ redisConnection: {} }));

vi.mock('../../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    ordemServico: { findMany: findManyMock, update: updateMock },
  },
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarTemplate: enviarTemplateMock,
}));

import { processarLembretesAgendamento } from '../lembrete-agendamento-worker';

function criarOsFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'os-1',
    numero: 'OS-2026-000042',
    dataAgendada: new Date(Date.now() + 20 * 60 * 60 * 1000),
    cliente: { telefoneWhatsapp: '5511999999999', nome: 'João' },
    ...overrides,
  };
}

describe('processarLembretesAgendamento', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    updateMock.mockReset().mockResolvedValue({});
    enviarTemplateMock.mockReset();
  });

  it('envia o lembrete e marca a OS quando o envio tem sucesso', async () => {
    findManyMock.mockResolvedValue([criarOsFake()]);
    enviarTemplateMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.1' });

    await processarLembretesAgendamento();

    expect(enviarTemplateMock).toHaveBeenCalledTimes(1);
    expect(enviarTemplateMock).toHaveBeenCalledWith(
      '5511999999999',
      expect.any(String),
      expect.arrayContaining(['OS-2026-000042']),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'os-1' },
        data: expect.objectContaining({ lembreteAgendamentoEnviadoEm: expect.any(Date) }),
      }),
    );
  });

  it('nao faz nada quando nao ha OS agendada na janela', async () => {
    findManyMock.mockResolvedValue([]);

    await processarLembretesAgendamento();

    expect(enviarTemplateMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('nao marca a OS quando o envio do lembrete falha (tentara de novo depois)', async () => {
    findManyMock.mockResolvedValue([criarOsFake()]);
    enviarTemplateMock.mockResolvedValue({ sucesso: false, erro: 'rede' });

    await processarLembretesAgendamento();

    expect(enviarTemplateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('processa varias OS e marca cada uma que foi enviada', async () => {
    findManyMock.mockResolvedValue([
      criarOsFake({ id: 'os-1', numero: 'OS-2026-000001' }),
      criarOsFake({ id: 'os-2', numero: 'OS-2026-000002' }),
    ]);
    enviarTemplateMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.x' });

    await processarLembretesAgendamento();

    expect(enviarTemplateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
