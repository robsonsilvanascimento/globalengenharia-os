import { describe, expect, it, beforeEach, vi } from 'vitest';

const { enqueueCalcularComissaoMock, enqueueEntregaReciboMock } = vi.hoisted(() => ({
  enqueueCalcularComissaoMock: vi.fn(),
  enqueueEntregaReciboMock: vi.fn(),
}));

vi.mock('../../../../shared/infra/queues', () => ({
  enqueueCalcularComissao: enqueueCalcularComissaoMock,
  enqueueEntregaRecibo: enqueueEntregaReciboMock,
}));

import { ProcessarWebhookPagamentoUseCase } from '../ProcessarWebhookPagamentoUseCase';
import type {
  CobrancaPixCriada,
  CriarCobrancaPixInput,
  EventoWebhookPagamento,
  PagamentoExterno,
  PaymentGateway,
} from '../../domain/PaymentGateway';
import type {
  RegistrarWebhookEventoDados,
  StatusWebhookEvento,
  WebhookEventoRegistrado,
  WebhookEventRepository,
} from '../../domain/WebhookEventRepository';

class FakeGateway implements PaymentGateway {
  public consultarPagamentoMock = vi.fn<(id: string) => Promise<PagamentoExterno | null>>();
  async criarCobrancaPix(_input: CriarCobrancaPixInput): Promise<CobrancaPixCriada> {
    throw new Error('nao usado neste teste');
  }
  async cancelarCobranca(): Promise<void> {
    throw new Error('nao usado neste teste');
  }
  async consultarPagamento(idExterno: string): Promise<PagamentoExterno | null> {
    return this.consultarPagamentoMock(idExterno);
  }
  validarAssinaturaWebhook(): boolean {
    throw new Error('nao usado neste teste');
  }
  extrairEventoWebhook(): EventoWebhookPagamento | null {
    throw new Error('nao usado neste teste');
  }
}

class FakeWebhookEventRepository implements WebhookEventRepository {
  public eventos: WebhookEventoRegistrado[] = [];
  private seq = 0;

  async registrar(dados: RegistrarWebhookEventoDados): Promise<WebhookEventoRegistrado> {
    const evento: WebhookEventoRegistrado = {
      id: `evt-${(this.seq += 1)}`,
      provedor: dados.provedor,
      tipoEvento: dados.tipoEvento,
      idExterno: dados.idExterno,
      status: 'pendente',
      criadoEm: new Date(),
    };
    this.eventos.push(evento);
    return evento;
  }
  async buscarPorId(id: string): Promise<WebhookEventoRegistrado | null> {
    return this.eventos.find((e) => e.id === id) ?? null;
  }
  private definirStatus(id: string, status: StatusWebhookEvento): void {
    const evento = this.eventos.find((e) => e.id === id);
    if (evento) evento.status = status;
  }
  async marcarProcessado(id: string): Promise<void> {
    this.definirStatus(id, 'processado');
  }
  async marcarFalhou(id: string): Promise<void> {
    this.definirStatus(id, 'falhou');
  }
  async marcarIgnorado(id: string): Promise<void> {
    this.definirStatus(id, 'ignorado');
  }
}

interface PagamentoOSFake {
  id: string;
  ordemServicoId: string;
  mercadoPagoId: string;
  valor: number;
  statusPagamento: 'pendente' | 'pago' | 'cancelado';
  pagoEm: Date | null;
}

/**
 * Fake minimo do PrismaClient: so implementa o que o use case realmente
 * chama. `$transaction` no modo callback invoca o callback passando o
 * proprio fake como `tx` — os mocks de update/findUniqueOrThrow sao os
 * mesmos objetos, entao as asserções nos testes continuam funcionando.
 */
function criarFakePrisma(pagamentos: PagamentoOSFake[], ordens: Array<{ id: string; statusPagamento: string }>) {
  const prisma = {
    pagamentoOS: {
      findFirst: vi.fn(async ({ where }: { where: { mercadoPagoId: string } }) =>
        pagamentos.find((p) => p.mercadoPagoId === where.mercadoPagoId) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = pagamentos.find((x) => x.id === where.id);
        if (!p) throw new Error(`PagamentoOS ${where.id} nao encontrado`);
        return p;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PagamentoOSFake> }) => {
        const p = pagamentos.find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      }),
    },
    ordemServico: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { statusPagamento: string } }) => {
        const os = ordens.find((x) => x.id === where.id)!;
        Object.assign(os, data);
        return os;
      }),
    },
    $executeRaw: vi.fn(async () => undefined),
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return arg(prisma);
      throw new Error('modo de transacao nao suportado neste fake');
    }),
  };
  return prisma;
}

const EVENTO_BASE = { provedor: 'mercadopago', tipoEvento: 'payment', idExterno: 'mp-123' };

describe('ProcessarWebhookPagamentoUseCase', () => {
  let gateway: FakeGateway;
  let webhookEventRepository: FakeWebhookEventRepository;

  beforeEach(() => {
    gateway = new FakeGateway();
    webhookEventRepository = new FakeWebhookEventRepository();
    enqueueCalcularComissaoMock.mockReset();
    enqueueEntregaReciboMock.mockReset();
  });

  it('retorna evento_nao_encontrado quando o id do Inbox nao existe', async () => {
    const prisma = criarFakePrisma([], []);
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: 'inexistente' });

    expect(resultado).toEqual({ processado: false, motivo: 'evento_nao_encontrado' });
    expect(gateway.consultarPagamentoMock).not.toHaveBeenCalled();
  });

  it('ignora quando o gateway nao encontra o pagamento', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue(null);
    const prisma = criarFakePrisma([], []);
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'pagamento_nao_encontrado_no_gateway' });
    expect(webhookEventRepository.eventos[0]?.status).toBe('ignorado');
  });

  it('ignora quando o pagamento no gateway ainda nao esta aprovado', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'pendente',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma([], []);
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'status_nao_aprovado' });
  });

  it('ignora quando nao existe PagamentoOS para o id externo', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma([], []);
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'pagamento_os_nao_encontrado' });
  });

  it('e idempotente: PagamentoOS ja pago nao reenvia comissao/recibo', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'pago', pagoEm: new Date() }],
      [],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'ja_confirmado' });
    expect(enqueueCalcularComissaoMock).not.toHaveBeenCalled();
    expect(enqueueEntregaReciboMock).not.toHaveBeenCalled();
    // marcado como processado (nao falhou nem foi ignorado) — o resultado e legitimo, so nao ha nada novo a fazer.
    expect(webhookEventRepository.eventos[0]?.status).toBe('processado');
  });

  it('ignora um pagamento cancelado manualmente, sem reverter a decisao do admin', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'cancelado', pagoEm: null }],
      [],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'pagamento_os_cancelado' });
    expect(prisma.pagamentoOS.update).not.toHaveBeenCalled();
  });

  it('ignora quando o valor pago diverge do valor cobrado', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 50, // pagou menos do que o cobrado
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'pendente', pagoEm: null }],
      [],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: false, motivo: 'valor_divergente' });
    expect(prisma.pagamentoOS.update).not.toHaveBeenCalled();
  });

  it('confirma o pagamento: atualiza PagamentoOS e OS numa transacao, enfileira comissao e recibo', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'pendente', pagoEm: null }],
      [{ id: 'os-1', statusPagamento: 'pendente' }],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Prova que o lock advisory foi de fato solicitado (serializacao por pagamento).
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.pagamentoOS.update).toHaveBeenCalledWith({
      where: { id: 'pg-1' },
      data: { statusPagamento: 'pago', pagoEm: expect.any(Date) },
    });
    expect(prisma.ordemServico.update).toHaveBeenCalledWith({
      where: { id: 'os-1' },
      data: { statusPagamento: 'pago' },
    });
    expect(enqueueCalcularComissaoMock).toHaveBeenCalledWith({ pagamentoOSId: 'pg-1' });
    expect(enqueueEntregaReciboMock).toHaveBeenCalledWith({ pagamentoOSId: 'pg-1' });
    expect(webhookEventRepository.eventos[0]?.status).toBe('processado');
  });

  it('duas entregas do mesmo webhook (dois eventos distintos no Inbox) nao duplicam comissao/recibo', async () => {
    // Simula o cenario que motivou o lock advisory: o Mercado Pago reentrega
    // o mesmo webhook, criando um segundo evento no Inbox para o MESMO
    // pagamento. O segundo job so roda apos o primeiro liberar o lock (aqui
    // simulado por rodar em sequencia sobre o mesmo estado compartilhado) e
    // deve encontrar o pagamento ja confirmado, sem reenfileirar nada.
    const eventoA = await webhookEventRepository.registrar(EVENTO_BASE);
    const eventoB = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'pendente', pagoEm: null }],
      [{ id: 'os-1', statusPagamento: 'pendente' }],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultadoA = await useCase.execute({ webhookEventId: eventoA.id });
    const resultadoB = await useCase.execute({ webhookEventId: eventoB.id });

    expect(resultadoA).toEqual({ processado: true });
    expect(resultadoB).toEqual({ processado: false, motivo: 'ja_confirmado' });
    expect(enqueueCalcularComissaoMock).toHaveBeenCalledTimes(1);
    expect(enqueueEntregaReciboMock).toHaveBeenCalledTimes(1);
    expect(webhookEventRepository.eventos.map((e) => e.status)).toEqual(['processado', 'processado']);
  });

  it('aceita pequena diferenca de arredondamento (<= 1 centavo) como valor correto', async () => {
    const evento = await webhookEventRepository.registrar(EVENTO_BASE);
    gateway.consultarPagamentoMock.mockResolvedValue({
      idExterno: 'mp-123',
      status: 'aprovado',
      valor: 100.001,
      referenciaExterna: 'os-1',
    });
    const prisma = criarFakePrisma(
      [{ id: 'pg-1', ordemServicoId: 'os-1', mercadoPagoId: 'mp-123', valor: 100, statusPagamento: 'pendente', pagoEm: null }],
      [{ id: 'os-1', statusPagamento: 'pendente' }],
    );
    const useCase = new ProcessarWebhookPagamentoUseCase({ prisma: prisma as never, gateway, webhookEventRepository });

    const resultado = await useCase.execute({ webhookEventId: evento.id });

    expect(resultado).toEqual({ processado: true });
  });
});
