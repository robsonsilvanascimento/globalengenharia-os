import { describe, expect, it, beforeEach } from 'vitest';
import { GerarCobrancasRecorrentesUseCase } from '../GerarCobrancasRecorrentesUseCase';
import { CriarContaReceberUseCase } from '../CriarContaReceberUseCase';
import { BaixarContaReceberUseCase } from '../BaixarContaReceberUseCase';
import { CancelarContaReceberUseCase } from '../CancelarContaReceberUseCase';
import { adicionarPeriodo } from '../../domain/periodicidade';
import type { ContaReceber } from '../../domain/ContaReceber';
import type {
  BaixaContaReceber,
  ContaReceberComCliente,
  ContaReceberRepository,
  CriarContaReceberDados,
  FiltroContasReceber,
} from '../../domain/ContaReceberRepository';
import type { ContratoRecorrente } from '../../domain/ContratoRecorrente';
import type {
  ContratoComCliente,
  ContratoRecorrenteRepository,
  CriarContratoDados,
} from '../../domain/ContratoRecorrenteRepository';

class FakeContaRepo implements ContaReceberRepository {
  public contas: ContaReceber[] = [];
  private seq = 0;
  async criar(d: CriarContaReceberDados): Promise<ContaReceber> {
    const conta: ContaReceber = {
      id: `conta-${(this.seq += 1)}`,
      numero: d.numero,
      clienteId: d.clienteId,
      contratoId: d.contratoId ?? null,
      descricao: d.descricao,
      valor: d.valor,
      vencimentoEm: d.vencimentoEm,
      status: 'aberta',
      pagoEm: null,
      valorPago: null,
      formaPagamento: null,
      observacao: d.observacao ?? null,
      criadoPorId: d.criadoPorId ?? null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.contas.push(conta);
    return conta;
  }
  async buscarPorId(id: string): Promise<ContaReceber | null> {
    return this.contas.find((c) => c.id === id) ?? null;
  }
  async listar(_f: FiltroContasReceber): Promise<ContaReceberComCliente[]> {
    return this.contas.map((c) => ({ ...c, clienteNome: 'Cliente' }));
  }
  async baixar(id: string, d: BaixaContaReceber): Promise<ContaReceber> {
    const c = this.contas.find((x) => x.id === id)!;
    Object.assign(c, { status: 'paga', pagoEm: d.pagoEm, valorPago: d.valorPago, formaPagamento: d.formaPagamento ?? null });
    return c;
  }
  async atualizarStatus(id: string, status: ContaReceber['status']): Promise<ContaReceber> {
    const c = this.contas.find((x) => x.id === id)!;
    c.status = status;
    return c;
  }
  async contarNoAno(ano: number): Promise<number> {
    return this.contas.filter((c) => c.criadoEm.getFullYear() === ano).length;
  }
  async marcarVencidasAntesDe(ref: Date): Promise<number> {
    let n = 0;
    for (const c of this.contas) {
      if (c.status === 'aberta' && c.vencimentoEm.getTime() < ref.getTime()) {
        c.status = 'vencida';
        n += 1;
      }
    }
    return n;
  }
  async existeParaContratoNoVencimento(contratoId: string, vencimentoEm: Date): Promise<boolean> {
    return this.contas.some((c) => c.contratoId === contratoId && c.vencimentoEm.getTime() === vencimentoEm.getTime());
  }
}

class FakeContratoRepo implements ContratoRecorrenteRepository {
  public contratos: ContratoRecorrente[] = [];
  private seq = 0;
  async criar(d: CriarContratoDados): Promise<ContratoRecorrente> {
    const c: ContratoRecorrente = {
      id: `contrato-${(this.seq += 1)}`,
      clienteId: d.clienteId,
      descricao: d.descricao,
      valor: d.valor,
      periodicidade: d.periodicidade,
      proximaCobrancaEm: d.proximaCobrancaEm,
      dataInicio: d.dataInicio,
      dataFim: d.dataFim ?? null,
      ativo: true,
      criadoPorId: d.criadoPorId ?? null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.contratos.push(c);
    return c;
  }
  async buscarPorId(id: string): Promise<ContratoRecorrente | null> {
    return this.contratos.find((c) => c.id === id) ?? null;
  }
  async listar(): Promise<ContratoComCliente[]> {
    return this.contratos.map((c) => ({ ...c, clienteNome: 'Cliente' }));
  }
  async definirAtivo(id: string, ativo: boolean): Promise<ContratoRecorrente> {
    const c = this.contratos.find((x) => x.id === id)!;
    c.ativo = ativo;
    return c;
  }
  async atualizarProximaCobranca(id: string, proximaCobrancaEm: Date): Promise<ContratoRecorrente> {
    const c = this.contratos.find((x) => x.id === id)!;
    c.proximaCobrancaEm = proximaCobrancaEm;
    return c;
  }
  async listarVencendoAte(ref: Date): Promise<ContratoRecorrente[]> {
    return this.contratos.filter((c) => c.ativo && c.proximaCobrancaEm.getTime() <= ref.getTime());
  }
}

describe('adicionarPeriodo', () => {
  it('avanca mensal, trimestral e anual', () => {
    expect(adicionarPeriodo(new Date('2026-01-10'), 'mensal').toISOString().slice(0, 10)).toBe('2026-02-10');
    expect(adicionarPeriodo(new Date('2026-01-10'), 'trimestral').toISOString().slice(0, 10)).toBe('2026-04-10');
    expect(adicionarPeriodo(new Date('2026-01-10'), 'anual').toISOString().slice(0, 10)).toBe('2027-01-10');
    expect(adicionarPeriodo(new Date('2026-01-10'), 'semanal').toISOString().slice(0, 10)).toBe('2026-01-17');
  });
});

describe('GerarCobrancasRecorrentesUseCase', () => {
  let contaRepo: FakeContaRepo;
  let contratoRepo: FakeContratoRepo;
  let gerar: GerarCobrancasRecorrentesUseCase;

  beforeEach(() => {
    contaRepo = new FakeContaRepo();
    contratoRepo = new FakeContratoRepo();
    gerar = new GerarCobrancasRecorrentesUseCase({
      contratoRecorrenteRepository: contratoRepo,
      contaReceberRepository: contaRepo,
    });
  });

  it('gera uma conta e avanca a proxima cobranca em um ciclo', async () => {
    await contratoRepo.criar({
      clienteId: 'cli-1',
      descricao: 'Manutencao mensal',
      valor: 500,
      periodicidade: 'mensal',
      proximaCobrancaEm: new Date('2026-07-01'),
      dataInicio: new Date('2026-07-01'),
    });
    const res = await gerar.execute(new Date('2026-07-05'));
    expect(res.contasGeradas).toBe(1);
    expect(contaRepo.contas).toHaveLength(1);
    expect(contaRepo.contas[0]?.valor).toBe(500);
    expect(contratoRepo.contratos[0]?.proximaCobrancaEm.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('faz catch-up de ciclos atrasados (varias contas de uma vez)', async () => {
    await contratoRepo.criar({
      clienteId: 'cli-1',
      descricao: 'Mensal',
      valor: 100,
      periodicidade: 'mensal',
      proximaCobrancaEm: new Date('2026-04-01'),
      dataInicio: new Date('2026-04-01'),
    });
    const res = await gerar.execute(new Date('2026-07-05'));
    // abril, maio, junho, julho = 4 contas
    expect(res.contasGeradas).toBe(4);
    expect(contratoRepo.contratos[0]?.proximaCobrancaEm.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('e idempotente: rodar de novo no mesmo dia nao duplica contas', async () => {
    await contratoRepo.criar({
      clienteId: 'cli-1',
      descricao: 'Mensal',
      valor: 100,
      periodicidade: 'mensal',
      proximaCobrancaEm: new Date('2026-07-01'),
      dataInicio: new Date('2026-07-01'),
    });
    await gerar.execute(new Date('2026-07-05'));
    const antes = contaRepo.contas.length;
    await gerar.execute(new Date('2026-07-05'));
    expect(contaRepo.contas.length).toBe(antes);
  });

  it('desativa o contrato ao ultrapassar a data de termino', async () => {
    await contratoRepo.criar({
      clienteId: 'cli-1',
      descricao: 'Mensal',
      valor: 100,
      periodicidade: 'mensal',
      proximaCobrancaEm: new Date('2026-07-01'),
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-08-15'),
    });
    await gerar.execute(new Date('2026-12-01'));
    // julho e agosto entram; setembro passa do fim -> desativa
    expect(contratoRepo.contratos[0]?.ativo).toBe(false);
    expect(contaRepo.contas.length).toBe(2);
  });

  it('nao processa contrato inativo', async () => {
    const c = await contratoRepo.criar({
      clienteId: 'cli-1',
      descricao: 'Mensal',
      valor: 100,
      periodicidade: 'mensal',
      proximaCobrancaEm: new Date('2026-07-01'),
      dataInicio: new Date('2026-07-01'),
    });
    await contratoRepo.definirAtivo(c.id, false);
    const res = await gerar.execute(new Date('2026-07-05'));
    expect(res.contasGeradas).toBe(0);
  });
});

describe('CriarContaReceberUseCase', () => {
  it('gera numero CR-ANO-NNNN e rejeita valor invalido', async () => {
    const repo = new FakeContaRepo();
    const uc = new CriarContaReceberUseCase({ contaReceberRepository: repo });
    const conta = await uc.execute({ clienteId: 'c1', descricao: 'Servico', valor: 250, vencimentoEm: new Date('2026-08-10') });
    expect(conta.numero).toMatch(/^CR-\d{4}-0001$/);
    await expect(uc.execute({ clienteId: 'c1', descricao: 'x', valor: 0, vencimentoEm: new Date() })).rejects.toThrow();
    await expect(uc.execute({ clienteId: 'c1', descricao: '  ', valor: 10, vencimentoEm: new Date() })).rejects.toThrow();
  });
});

describe('Baixar e Cancelar ContaReceber', () => {
  let repo: FakeContaRepo;
  beforeEach(() => {
    repo = new FakeContaRepo();
  });

  async function novaConta() {
    return new CriarContaReceberUseCase({ contaReceberRepository: repo }).execute({
      clienteId: 'c1',
      descricao: 'Servico',
      valor: 300,
      vencimentoEm: new Date('2026-08-10'),
    });
  }

  it('baixa uma conta em aberto (marca paga com valor)', async () => {
    const conta = await novaConta();
    const baixar = new BaixarContaReceberUseCase({ contaReceberRepository: repo });
    const paga = await baixar.execute({ id: conta.id, formaPagamento: 'pix' });
    expect(paga.status).toBe('paga');
    expect(paga.valorPago).toBe(300);
    expect(paga.formaPagamento).toBe('pix');
  });

  it('nao permite baixar conta ja paga nem cancelada', async () => {
    const conta = await novaConta();
    const baixar = new BaixarContaReceberUseCase({ contaReceberRepository: repo });
    await baixar.execute({ id: conta.id });
    await expect(baixar.execute({ id: conta.id })).rejects.toThrow();

    const outra = await novaConta();
    await new CancelarContaReceberUseCase({ contaReceberRepository: repo }).execute(outra.id);
    await expect(baixar.execute({ id: outra.id })).rejects.toThrow();
  });

  it('nao permite cancelar conta paga', async () => {
    const conta = await novaConta();
    await new BaixarContaReceberUseCase({ contaReceberRepository: repo }).execute({ id: conta.id });
    await expect(new CancelarContaReceberUseCase({ contaReceberRepository: repo }).execute(conta.id)).rejects.toThrow();
  });
});
