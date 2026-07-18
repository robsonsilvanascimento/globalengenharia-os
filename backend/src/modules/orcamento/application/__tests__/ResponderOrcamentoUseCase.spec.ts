import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ResponderOrcamentoUseCase } from '../ResponderOrcamentoUseCase';
import type { OrcamentoOS, StatusOrcamento } from '../../domain/OrcamentoOS';
import type { OrcamentoOSRepository, SalvarOrcamentoDados } from '../../domain/OrcamentoOSRepository';

class FakeOrcamentoRepository implements OrcamentoOSRepository {
  public orcamentos: OrcamentoOS[] = [];
  async salvar(_dados: SalvarOrcamentoDados): Promise<OrcamentoOS> {
    throw new Error('nao usado');
  }
  async buscarPorOrdemServico(): Promise<OrcamentoOS | null> {
    return null;
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
}

function orcamentoFake(overrides: Partial<OrcamentoOS> = {}): OrcamentoOS {
  return {
    id: 'orc-1',
    ordemServicoId: 'os-1',
    status: 'pendente',
    valorTotal: 500,
    itens: [{ descricao: 'Item', valor: 500 }],
    observacao: null,
    tokenAprovacao: 'a'.repeat(64),
    enviadoEm: new Date(),
    respondidoEm: null,
    criadoPorId: 'user-1',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

describe('ResponderOrcamentoUseCase', () => {
  let repo: FakeOrcamentoRepository;
  beforeEach(() => {
    repo = new FakeOrcamentoRepository();
  });

  it('aprova um orcamento pendente e dispara o efeito aoAprovar', async () => {
    repo.orcamentos.push(orcamentoFake());
    const aoAprovar = vi.fn().mockResolvedValue(undefined);
    const useCase = new ResponderOrcamentoUseCase({ orcamentoRepository: repo, aoAprovar });

    const { orcamento, efetivou } = await useCase.execute('a'.repeat(64), 'aprovar');

    expect(orcamento.status).toBe('aprovado');
    expect(efetivou).toBe(true);
    expect(aoAprovar).toHaveBeenCalledTimes(1);
  });

  it('recusa um orcamento pendente sem disparar aoAprovar', async () => {
    repo.orcamentos.push(orcamentoFake());
    const aoAprovar = vi.fn();
    const useCase = new ResponderOrcamentoUseCase({ orcamentoRepository: repo, aoAprovar });

    const { orcamento } = await useCase.execute('a'.repeat(64), 'recusar');

    expect(orcamento.status).toBe('recusado');
    expect(aoAprovar).not.toHaveBeenCalled();
  });

  it('e idempotente para a mesma decisao (nao efetiva de novo)', async () => {
    repo.orcamentos.push(orcamentoFake({ status: 'aprovado', respondidoEm: new Date() }));
    const aoAprovar = vi.fn();
    const useCase = new ResponderOrcamentoUseCase({ orcamentoRepository: repo, aoAprovar });

    const { efetivou } = await useCase.execute('a'.repeat(64), 'aprovar');

    expect(efetivou).toBe(false);
    expect(aoAprovar).not.toHaveBeenCalled();
  });

  it('rejeita trocar uma decisao ja registrada (recusado -> aprovar)', async () => {
    repo.orcamentos.push(orcamentoFake({ status: 'recusado', respondidoEm: new Date() }));
    const useCase = new ResponderOrcamentoUseCase({ orcamentoRepository: repo });

    await expect(useCase.execute('a'.repeat(64), 'aprovar')).rejects.toThrow();
  });

  it('lanca erro quando o token nao corresponde a nenhum orcamento', async () => {
    const useCase = new ResponderOrcamentoUseCase({ orcamentoRepository: repo });
    await expect(useCase.execute('token-inexistente-'.padEnd(64, 'x'), 'aprovar')).rejects.toThrow();
  });
});
