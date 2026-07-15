import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { PixWhatsappJobData } from '../../../../../shared/infra/queues';
import type { NotificacaoEnviadaRepository } from '../../../../notificacoes/domain/NotificacaoEnviadaRepository';

const { findUniqueOrdemServicoMock, gerarOuReutilizarPixMock, enviarTemplateMock } = vi.hoisted(() => ({
  findUniqueOrdemServicoMock: vi.fn(),
  gerarOuReutilizarPixMock: vi.fn(),
  enviarTemplateMock: vi.fn(),
}));

vi.mock('../../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    ordemServico: { findUnique: findUniqueOrdemServicoMock },
  },
}));

vi.mock('../../../application/GerarOuReutilizarPixUseCase', () => ({
  gerarOuReutilizarPix: gerarOuReutilizarPixMock,
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarTemplate: enviarTemplateMock,
}));

import { processarPixWhatsappJob } from '../pix-whatsapp-worker';

function criarOrdemServicoComClienteFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'os-1',
    numero: 'OS-2026-000001',
    statusPagamento: 'pendente',
    valorCobrado: 150,
    cliente: {
      id: 'cliente-1',
      nome: 'Cliente Teste',
      email: null,
      telefoneWhatsapp: '5511999999999',
    },
    ...overrides,
  };
}

function criarJobFake(data: PixWhatsappJobData): Job<PixWhatsappJobData> {
  return { data, attemptsMade: 0 } as Job<PixWhatsappJobData>;
}

describe('processarPixWhatsappJob', () => {
  let notificacaoEnviadaRepository: NotificacaoEnviadaRepository;
  let createNotificacaoMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUniqueOrdemServicoMock.mockReset();
    gerarOuReutilizarPixMock.mockReset();
    enviarTemplateMock.mockReset();

    createNotificacaoMock = vi.fn();
    notificacaoEnviadaRepository = { create: createNotificacaoMock } as unknown as NotificacaoEnviadaRepository;
  });

  it('gera o Pix e envia via WhatsApp quando a OS concluida tem valor cobrado e nao esta paga', async () => {
    findUniqueOrdemServicoMock.mockResolvedValue(criarOrdemServicoComClienteFake());
    gerarOuReutilizarPixMock.mockResolvedValue({ pixCopiaECola: 'codigo-pix-fake' });
    enviarTemplateMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });

    await processarPixWhatsappJob(criarJobFake({ ordemServicoId: 'os-1' }), { notificacaoEnviadaRepository });

    expect(gerarOuReutilizarPixMock).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-1', valorCobrado: 150, clienteNome: 'Cliente Teste' }),
      expect.anything(),
    );
    expect(enviarTemplateMock).toHaveBeenCalledWith(
      '5511999999999',
      'pix_cobranca',
      expect.arrayContaining(['OS-2026-000001', 'codigo-pix-fake']),
    );
    expect(createNotificacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-1', statusEnvio: 'enviada' }),
    );
  });

  it('nao gera Pix quando a OS ja esta paga', async () => {
    findUniqueOrdemServicoMock.mockResolvedValue(
      criarOrdemServicoComClienteFake({ statusPagamento: 'pago' }),
    );

    await processarPixWhatsappJob(criarJobFake({ ordemServicoId: 'os-1' }), { notificacaoEnviadaRepository });

    expect(gerarOuReutilizarPixMock).not.toHaveBeenCalled();
    expect(enviarTemplateMock).not.toHaveBeenCalled();
  });

  it('nao gera Pix quando a OS nao tem valor cobrado definido', async () => {
    findUniqueOrdemServicoMock.mockResolvedValue(
      criarOrdemServicoComClienteFake({ valorCobrado: null }),
    );

    await processarPixWhatsappJob(criarJobFake({ ordemServicoId: 'os-1' }), { notificacaoEnviadaRepository });

    expect(gerarOuReutilizarPixMock).not.toHaveBeenCalled();
    expect(enviarTemplateMock).not.toHaveBeenCalled();
  });

  it('lanca erro quando a OS nao e encontrada', async () => {
    findUniqueOrdemServicoMock.mockResolvedValue(null);

    await expect(
      processarPixWhatsappJob(criarJobFake({ ordemServicoId: 'os-1' }), { notificacaoEnviadaRepository }),
    ).rejects.toThrow(/nao encontrada/);

    expect(gerarOuReutilizarPixMock).not.toHaveBeenCalled();
  });

  it('registra falha e relanca o erro quando o envio via WhatsApp falha', async () => {
    findUniqueOrdemServicoMock.mockResolvedValue(criarOrdemServicoComClienteFake());
    gerarOuReutilizarPixMock.mockResolvedValue({ pixCopiaECola: 'codigo-pix-fake' });
    enviarTemplateMock.mockResolvedValue({ sucesso: false, erro: 'Falha na Meta Cloud API' });

    await expect(
      processarPixWhatsappJob(criarJobFake({ ordemServicoId: 'os-1' }), { notificacaoEnviadaRepository }),
    ).rejects.toThrow('Falha na Meta Cloud API');

    expect(createNotificacaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusEnvio: 'falhou' }),
    );
  });
});
