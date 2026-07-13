import type { OrdemServico } from '../domain/OrdemServico';
import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface RegistrarValorOrdemServicoInput {
  ordemServicoId: string;
  valorCobrado: number;
}

export interface RegistrarValorOrdemServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
}

/**
 * Registra o valor cobrado (financeiro) de uma Ordem de Servico. E apenas um
 * registro de dado — nao mexe em status nem gera historico.
 */
export class RegistrarValorOrdemServicoUseCase {
  constructor(private readonly deps: RegistrarValorOrdemServicoDeps) {}

  async execute(input: RegistrarValorOrdemServicoInput): Promise<OrdemServico> {
    const { ordemServicoRepository } = this.deps;

    const existente = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!existente) {
      throw new OrdemServicoNaoEncontradaError(input.ordemServicoId);
    }

    return ordemServicoRepository.update(input.ordemServicoId, {
      valorCobrado: input.valorCobrado,
    });
  }
}
