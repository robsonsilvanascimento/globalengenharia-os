import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificacaoWhatsappJobData } from '../../../../../shared/infra/queues';
import type { Cliente } from '../../../../clientes/domain/Cliente';
import type { ClienteRepository } from '../../../../clientes/domain/ClienteRepository';
import type { OrdemServico } from '../../../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../../../ordens-servico/domain/OrdemServicoRepository';
import type { NotificacaoEnviadaRepository } from '../../../domain/NotificacaoEnviadaRepository';

const { enviarTemplateMock } = vi.hoisted(() => ({
  enviarTemplateMock: vi.fn(),
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarTemplate: enviarTemplateMock,
}));

import { processarNotificacaoJob } from '../notificacao-worker';

function criarClienteFake(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: 'cliente-1',
    nome: 'Cliente Teste',
    telefoneWhatsapp: '5511999999999',
    documento: null,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  return {
    id: 'os-1',
    numero: 'OS-0001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema teste',
    prioridade: 'normal',
    status: 'em_andamento',
    criadoVia: 'painel',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

function criarJobFake(
  data: NotificacaoWhatsappJobData,
  attemptsMade = 0,
): Job<NotificacaoWhatsappJobData> {
  return { data, attemptsMade } as Job<NotificacaoWhatsappJobData>;
}

describe('processarNotificacaoJob', () => {
  let clienteRepository: ClienteRepository;
  let ordemServicoRepository: OrdemServicoRepository;
  let notificacaoEnviadaRepository: NotificacaoEnviadaRepository;
  let createMock: ReturnType<typeof vi.fn>;
  let findClienteByIdMock: ReturnType<typeof vi.fn>;
  let findOrdemServicoByIdMock: ReturnType<typeof vi.fn>;

  const jobData: NotificacaoWhatsappJobData = {
    ordemServicoId: 'os-1',
    clienteId: 'cliente-1',
    statusNovo: 'em_andamento',
    templateNome: 'status_em_andamento',
  };

  beforeEach(() => {
    enviarTemplateMock.mockReset();
    createMock = vi.fn().mockImplementation(async (dados) => ({ id: 'notificacao-1', criadoEm: new Date(), ...dados }));
    findClienteByIdMock = vi.fn().mockResolvedValue(criarClienteFake());
    findOrdemServicoByIdMock = vi.fn().mockResolvedValue(criarOrdemServicoFake());

    clienteRepository = { findById: findClienteByIdMock } as unknown as ClienteRepository;
    ordemServicoRepository = { findById: findOrdemServicoByIdMock } as unknown as OrdemServicoRepository;
    notificacaoEnviadaRepository = { create: createMock } as unknown as NotificacaoEnviadaRepository;
  });

  it('envia o template e grava NotificacaoEnviada com status "enviada" no caminho de sucesso', async () => {
    enviarTemplateMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });

    await processarNotificacaoJob(criarJobFake(jobData), {
      clienteRepository,
      ordemServicoRepository,
      notificacaoEnviadaRepository,
    });

    expect(enviarTemplateMock).toHaveBeenCalledWith('5511999999999', 'status_em_andamento', [
      'OS-0001',
      'em_andamento',
    ]);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        clienteId: 'cliente-1',
        statusEnvio: 'enviada',
        tentativas: 1,
        templateUsado: 'status_em_andamento',
        enviadoEm: expect.any(Date),
      }),
    );
  });

  it('grava NotificacaoEnviada com status "falhou" e relanca o erro quando o envio falha', async () => {
    enviarTemplateMock.mockResolvedValue({ sucesso: false, erro: 'template nao aprovado' });

    await expect(
      processarNotificacaoJob(criarJobFake(jobData, 1), {
        clienteRepository,
        ordemServicoRepository,
        notificacaoEnviadaRepository,
      }),
    ).rejects.toThrow('template nao aprovado');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        clienteId: 'cliente-1',
        statusEnvio: 'falhou',
        tentativas: 2,
      }),
    );
  });

  it('grava falha e relanca erro quando o cliente nao e encontrado, sem chamar enviarTemplate', async () => {
    findClienteByIdMock.mockResolvedValue(null);

    await expect(
      processarNotificacaoJob(criarJobFake(jobData), {
        clienteRepository,
        ordemServicoRepository,
        notificacaoEnviadaRepository,
      }),
    ).rejects.toThrow(/nao encontrado/);

    expect(enviarTemplateMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ ordemServicoId: 'os-1', clienteId: 'cliente-1', statusEnvio: 'falhou' }),
    );
  });
});
