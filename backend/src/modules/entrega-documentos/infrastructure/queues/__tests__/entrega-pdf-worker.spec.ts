import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { EntregaPdfOSJobData } from '../../../../../shared/infra/queues';
import type { Cliente } from '../../../../clientes/domain/Cliente';
import type { ClienteRepository } from '../../../../clientes/domain/ClienteRepository';
import type { CategoriaServico } from '../../../../categorias-servico/domain/CategoriaServico';
import type { CategoriaServicoRepository } from '../../../../categorias-servico/domain/CategoriaServicoRepository';
import type { OrdemServico } from '../../../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../../../ordens-servico/domain/OrdemServicoRepository';

const { gerarPdfOrdemServicoMock, enviarDocumentoMock, enviarEmailComAnexoMock } = vi.hoisted(() => ({
  gerarPdfOrdemServicoMock: vi.fn(),
  enviarDocumentoMock: vi.fn(),
  enviarEmailComAnexoMock: vi.fn(),
}));

vi.mock('../../../../../shared/infra/pdf/GerarPdfOrdemServicoService', () => ({
  gerarPdfOrdemServico: gerarPdfOrdemServicoMock,
}));

vi.mock('../../../../../shared/infra/email/EmailService', () => ({
  enviarEmailComAnexo: enviarEmailComAnexoMock,
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarDocumento: enviarDocumentoMock,
}));

import { processarEntregaPdfOSJob } from '../entrega-pdf-worker';

function criarClienteFake(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: 'cliente-1',
    nome: 'Cliente Teste',
    telefoneWhatsapp: '5511999999999',
    documento: null,
    email: null,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarCategoriaFake(overrides: Partial<CategoriaServico> = {}): CategoriaServico {
  return {
    id: 'categoria-1',
    nome: 'Eletrica',
    area: 'eletrica',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  return {
    id: 'os-1',
    numero: 'OS-2026-000001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema teste',
    prioridade: 'normal',
    status: 'aberta',
    criadoVia: 'painel',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

function criarJobFake(data: EntregaPdfOSJobData): Job<EntregaPdfOSJobData> {
  return { data } as Job<EntregaPdfOSJobData>;
}

describe('processarEntregaPdfOSJob', () => {
  let ordemServicoRepository: OrdemServicoRepository;
  let clienteRepository: ClienteRepository;
  let categoriaServicoRepository: CategoriaServicoRepository;
  let findOrdemServicoByIdMock: ReturnType<typeof vi.fn>;
  let findClienteByIdMock: ReturnType<typeof vi.fn>;
  let findCategoriaByIdMock: ReturnType<typeof vi.fn>;

  const jobData: EntregaPdfOSJobData = { ordemServicoId: 'os-1' };
  const pdfFake = Buffer.from('pdf-fake-content');

  beforeEach(() => {
    gerarPdfOrdemServicoMock.mockReset().mockResolvedValue(pdfFake);
    enviarDocumentoMock.mockReset();
    enviarEmailComAnexoMock.mockReset();

    findOrdemServicoByIdMock = vi.fn().mockResolvedValue(criarOrdemServicoFake());
    findClienteByIdMock = vi.fn().mockResolvedValue(criarClienteFake());
    findCategoriaByIdMock = vi.fn().mockResolvedValue(criarCategoriaFake());

    ordemServicoRepository = { findById: findOrdemServicoByIdMock } as unknown as OrdemServicoRepository;
    clienteRepository = { findById: findClienteByIdMock } as unknown as ClienteRepository;
    categoriaServicoRepository = { findById: findCategoriaByIdMock } as unknown as CategoriaServicoRepository;
  });

  it('entrega o PDF via WhatsApp e e-mail quando o cliente tem e-mail cadastrado', async () => {
    findClienteByIdMock.mockResolvedValue(criarClienteFake({ email: 'cliente@teste.com' }));
    enviarDocumentoMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });
    enviarEmailComAnexoMock.mockResolvedValue({ sucesso: true });

    await processarEntregaPdfOSJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      categoriaServicoRepository,
    });

    expect(gerarPdfOrdemServicoMock).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 'OS-2026-000001', clienteNome: 'Cliente Teste', categoriaNome: 'Eletrica' }),
    );
    expect(enviarDocumentoMock).toHaveBeenCalledWith(
      '5511999999999',
      pdfFake,
      'OS-OS-2026-000001.pdf',
      'application/pdf',
      expect.any(String),
    );
    expect(enviarEmailComAnexoMock).toHaveBeenCalledWith(
      'cliente@teste.com',
      expect.stringContaining('OS-2026-000001'),
      expect.any(String),
      expect.objectContaining({ filename: 'OS-OS-2026-000001.pdf', content: pdfFake }),
    );
  });

  it('entrega apenas via WhatsApp quando o cliente nao tem e-mail cadastrado', async () => {
    findClienteByIdMock.mockResolvedValue(criarClienteFake({ email: null }));
    enviarDocumentoMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });

    await processarEntregaPdfOSJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      categoriaServicoRepository,
    });

    expect(enviarDocumentoMock).toHaveBeenCalledTimes(1);
    expect(enviarEmailComAnexoMock).not.toHaveBeenCalled();
  });

  it('nao impede o envio por WhatsApp quando o envio por e-mail falha', async () => {
    findClienteByIdMock.mockResolvedValue(criarClienteFake({ email: 'cliente@teste.com' }));
    enviarDocumentoMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });
    enviarEmailComAnexoMock.mockResolvedValue({ sucesso: false, erro: 'SMTP indisponivel' });

    await expect(
      processarEntregaPdfOSJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        categoriaServicoRepository,
      }),
    ).resolves.toBeUndefined();

    expect(enviarDocumentoMock).toHaveBeenCalledTimes(1);
    expect(enviarEmailComAnexoMock).toHaveBeenCalledTimes(1);
  });

  it('nao impede o envio por e-mail quando o envio por WhatsApp falha', async () => {
    findClienteByIdMock.mockResolvedValue(criarClienteFake({ email: 'cliente@teste.com' }));
    enviarDocumentoMock.mockResolvedValue({ sucesso: false, erro: 'Falha na Meta Cloud API' });
    enviarEmailComAnexoMock.mockResolvedValue({ sucesso: true });

    await expect(
      processarEntregaPdfOSJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        categoriaServicoRepository,
      }),
    ).resolves.toBeUndefined();

    expect(enviarDocumentoMock).toHaveBeenCalledTimes(1);
    expect(enviarEmailComAnexoMock).toHaveBeenCalledTimes(1);
  });

  it('nao impede o envio por e-mail quando o envio por WhatsApp lanca excecao', async () => {
    findClienteByIdMock.mockResolvedValue(criarClienteFake({ email: 'cliente@teste.com' }));
    enviarDocumentoMock.mockRejectedValue(new Error('erro de rede'));
    enviarEmailComAnexoMock.mockResolvedValue({ sucesso: true });

    await expect(
      processarEntregaPdfOSJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        categoriaServicoRepository,
      }),
    ).resolves.toBeUndefined();

    expect(enviarEmailComAnexoMock).toHaveBeenCalledTimes(1);
  });

  it('lanca erro quando a Ordem de Servico nao e encontrada', async () => {
    findOrdemServicoByIdMock.mockResolvedValue(null);

    await expect(
      processarEntregaPdfOSJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        categoriaServicoRepository,
      }),
    ).rejects.toThrow(/nao encontrada/);

    expect(gerarPdfOrdemServicoMock).not.toHaveBeenCalled();
  });

  it('lanca erro quando o cliente nao e encontrado', async () => {
    findClienteByIdMock.mockResolvedValue(null);

    await expect(
      processarEntregaPdfOSJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        categoriaServicoRepository,
      }),
    ).rejects.toThrow(/nao encontrado/);

    expect(gerarPdfOrdemServicoMock).not.toHaveBeenCalled();
  });
});
