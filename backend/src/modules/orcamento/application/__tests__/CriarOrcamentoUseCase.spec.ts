import { describe, expect, it, beforeEach } from 'vitest';
import { CriarOrcamentoUseCase } from '../CriarOrcamentoUseCase';
import type { OrcamentoOS, StatusOrcamento } from '../../domain/OrcamentoOS';
import type { OrcamentoOSRepository, SalvarOrcamentoDados } from '../../domain/OrcamentoOSRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';

class FakeOrcamentoRepository implements OrcamentoOSRepository {
  public orcamentos: OrcamentoOS[] = [];
  private seq = 0;

  async salvar(dados: SalvarOrcamentoDados): Promise<OrcamentoOS> {
    const existente = this.orcamentos.find((o) => o.ordemServicoId === dados.ordemServicoId);
    const base: OrcamentoOS = {
      id: existente?.id ?? `orc-${(this.seq += 1)}`,
      ordemServicoId: dados.ordemServicoId,
      status: 'pendente',
      valorTotal: dados.valorTotal,
      itens: dados.itens,
      observacao: dados.observacao ?? null,
      tokenAprovacao: dados.tokenAprovacao,
      enviadoEm: null,
      respondidoEm: null,
      criadoPorId: dados.criadoPorId,
      criadoEm: existente?.criadoEm ?? new Date(),
      atualizadoEm: new Date(),
    };
    this.orcamentos = this.orcamentos.filter((o) => o.ordemServicoId !== dados.ordemServicoId);
    this.orcamentos.push(base);
    return base;
  }
  async buscarPorOrdemServico(ordemServicoId: string): Promise<OrcamentoOS | null> {
    return this.orcamentos.find((o) => o.ordemServicoId === ordemServicoId) ?? null;
  }
  async buscarPorToken(token: string): Promise<OrcamentoOS | null> {
    return this.orcamentos.find((o) => o.tokenAprovacao === token) ?? null;
  }
  async marcarEnviado(id: string, enviadoEm: Date): Promise<OrcamentoOS> {
    const o = this.orcamentos.find((x) => x.id === id)!;
    o.enviadoEm = enviadoEm;
    return o;
  }
  async registrarResposta(id: string, status: StatusOrcamento, respondidoEm: Date): Promise<OrcamentoOS> {
    const o = this.orcamentos.find((x) => x.id === id)!;
    o.status = status;
    o.respondidoEm = respondidoEm;
    return o;
  }
  seed(o: OrcamentoOS): void {
    this.orcamentos.push(o);
  }
}

function ordemServicoRepositoryFake(existe: boolean): OrdemServicoRepository {
  return {
    findById: async (id: string) => (existe ? ({ id } as never) : null),
  } as unknown as OrdemServicoRepository;
}

function criarUseCase(existeOs = true) {
  const orcamentoRepository = new FakeOrcamentoRepository();
  const useCase = new CriarOrcamentoUseCase({
    orcamentoRepository,
    ordemServicoRepository: ordemServicoRepositoryFake(existeOs),
  });
  return { useCase, orcamentoRepository };
}

const itensValidos = [
  { descricao: 'Mão de obra (2h)', valor: 200 },
  { descricao: 'Deslocamento', valor: 50 },
  { descricao: 'Materiais', valor: 200.5 },
];

describe('CriarOrcamentoUseCase', () => {
  let ctx: ReturnType<typeof criarUseCase>;
  beforeEach(() => {
    ctx = criarUseCase();
  });

  it('cria o orcamento somando os itens no valor total e gerando token de aprovacao', async () => {
    const orcamento = await ctx.useCase.execute({
      ordemServicoId: 'os-1',
      itens: itensValidos,
      criadoPorId: 'user-1',
    });

    expect(orcamento.valorTotal).toBe(450.5);
    expect(orcamento.status).toBe('pendente');
    expect(orcamento.tokenAprovacao).toHaveLength(64);
    expect(orcamento.itens).toHaveLength(3);
  });

  it('lanca erro quando a OS nao existe', async () => {
    const { useCase } = criarUseCase(false);
    await expect(
      useCase.execute({ ordemServicoId: 'os-x', itens: itensValidos, criadoPorId: 'user-1' }),
    ).rejects.toThrow();
  });

  it('rejeita orcamento sem itens', async () => {
    await expect(
      ctx.useCase.execute({ ordemServicoId: 'os-1', itens: [], criadoPorId: 'user-1' }),
    ).rejects.toThrow();
  });

  it('rejeita item com valor zero ou negativo', async () => {
    await expect(
      ctx.useCase.execute({
        ordemServicoId: 'os-1',
        itens: [{ descricao: 'Item', valor: 0 }],
        criadoPorId: 'user-1',
      }),
    ).rejects.toThrow();
  });

  it('rejeita item sem descricao', async () => {
    await expect(
      ctx.useCase.execute({
        ordemServicoId: 'os-1',
        itens: [{ descricao: '   ', valor: 100 }],
        criadoPorId: 'user-1',
      }),
    ).rejects.toThrow();
  });

  it('permite substituir um orcamento ainda pendente (nova proposta)', async () => {
    await ctx.useCase.execute({ ordemServicoId: 'os-1', itens: itensValidos, criadoPorId: 'user-1' });
    const novo = await ctx.useCase.execute({
      ordemServicoId: 'os-1',
      itens: [{ descricao: 'Novo valor', valor: 300 }],
      criadoPorId: 'user-1',
    });
    expect(novo.valorTotal).toBe(300);
    expect(ctx.orcamentoRepository.orcamentos).toHaveLength(1);
  });

  it('nao permite substituir um orcamento ja aprovado', async () => {
    const aprovado = await ctx.useCase.execute({
      ordemServicoId: 'os-1',
      itens: itensValidos,
      criadoPorId: 'user-1',
    });
    aprovado.status = 'aprovado';

    await expect(
      ctx.useCase.execute({
        ordemServicoId: 'os-1',
        itens: [{ descricao: 'Outro', valor: 999 }],
        criadoPorId: 'user-1',
      }),
    ).rejects.toThrow();
  });
});
