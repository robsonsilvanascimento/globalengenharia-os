import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { EntregaReciboJobData } from '../../../../../shared/infra/queues';

const { findUniquePagamentoMock, gerarReciboPagamentoMock, enviarDocumentoMock } = vi.hoisted(() => ({
  findUniquePagamentoMock: vi.fn(),
  gerarReciboPagamentoMock: vi.fn(),
  enviarDocumentoMock: vi.fn(),
}));

vi.mock('../../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    pagamentoOS: { findUnique: findUniquePagamentoMock },
  },
}));

vi.mock('../../../../../shared/infra/pdf/GerarReciboPagamentoService', () => ({
  gerarReciboPagamento: gerarReciboPagamentoMock,
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarDocumento: enviarDocumentoMock,
}));

import { processarEntregaReciboJob } from '../entrega-recibo-worker';

function criarPagamentoFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pagamento-1',
    statusPagamento: 'pago',
    valor: 150,
    tipo: 'pix_automatico',
    pagoEm: new Date('2026-07-16T10:00:00Z'),
    observacao: null,
    ordemServico: {
      numero: 'OS-2026-000001',
      cliente: { nome: 'Cliente Teste', telefoneWhatsapp: '5511999999999' },
    },
    ...overrides,
  };
}

function criarJobFake(data: EntregaReciboJobData): Job<EntregaReciboJobData> {
  return { data } as Job<EntregaReciboJobData>;
}

describe('processarEntregaReciboJob', () => {
  beforeEach(() => {
    findUniquePagamentoMock.mockReset();
    gerarReciboPagamentoMock.mockReset();
    enviarDocumentoMock.mockReset();
  });

  it('gera o recibo e entrega via WhatsApp quando o pagamento esta confirmado', async () => {
    findUniquePagamentoMock.mockResolvedValue(criarPagamentoFake());
    gerarReciboPagamentoMock.mockResolvedValue(Buffer.from('pdf-fake'));
    enviarDocumentoMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });

    await processarEntregaReciboJob(criarJobFake({ pagamentoOSId: 'pagamento-1' }));

    expect(gerarReciboPagamentoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        numeroOS: 'OS-2026-000001',
        clienteNome: 'Cliente Teste',
        valor: 150,
        tipoPagamento: 'pix_automatico',
      }),
    );
    expect(enviarDocumentoMock).toHaveBeenCalledWith(
      '5511999999999',
      expect.any(Buffer),
      'recibo-OS-2026-000001.pdf',
      'application/pdf',
      expect.any(String),
    );
  });

  it('nao envia recibo quando o pagamento ainda nao esta confirmado', async () => {
    findUniquePagamentoMock.mockResolvedValue(criarPagamentoFake({ statusPagamento: 'pendente' }));

    await processarEntregaReciboJob(criarJobFake({ pagamentoOSId: 'pagamento-1' }));

    expect(gerarReciboPagamentoMock).not.toHaveBeenCalled();
    expect(enviarDocumentoMock).not.toHaveBeenCalled();
  });

  it('lanca erro quando o pagamento nao e encontrado', async () => {
    findUniquePagamentoMock.mockResolvedValue(null);

    await expect(
      processarEntregaReciboJob(criarJobFake({ pagamentoOSId: 'pagamento-1' })),
    ).rejects.toThrow(/nao encontrado/);

    expect(gerarReciboPagamentoMock).not.toHaveBeenCalled();
  });

  it('nao lanca erro quando o envio via WhatsApp falha (apenas loga)', async () => {
    findUniquePagamentoMock.mockResolvedValue(criarPagamentoFake());
    gerarReciboPagamentoMock.mockResolvedValue(Buffer.from('pdf-fake'));
    enviarDocumentoMock.mockResolvedValue({ sucesso: false, erro: 'Falha na Meta Cloud API' });

    await expect(
      processarEntregaReciboJob(criarJobFake({ pagamentoOSId: 'pagamento-1' })),
    ).resolves.toBeUndefined();
  });
});
