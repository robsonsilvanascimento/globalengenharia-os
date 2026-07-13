import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import type { OrdemServico } from '../domain/OrdemServico';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface BuscarOrdemServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
}

/** Busca uma Ordem de Servico pelo id. Lanca OrdemServicoNaoEncontradaError se nao existir. */
export class BuscarOrdemServicoUseCase {
  constructor(private readonly deps: BuscarOrdemServicoDeps) {}

  async execute(ordemServicoId: string): Promise<OrdemServico> {
    const ordemServico = await this.deps.ordemServicoRepository.findById(ordemServicoId);

    if (!ordemServico) {
      throw new OrdemServicoNaoEncontradaError(ordemServicoId);
    }

    return ordemServico;
  }
}
