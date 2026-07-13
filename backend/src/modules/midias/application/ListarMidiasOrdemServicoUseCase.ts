import type { MidiaOrdemServico } from '../domain/MidiaOrdemServico';
import type { MidiaOrdemServicoRepository } from '../domain/MidiaOrdemServicoRepository';

export interface ListarMidiasOrdemServicoDeps {
  midiaOrdemServicoRepository: MidiaOrdemServicoRepository;
}

/** Lista as midias associadas a uma Ordem de Servico. */
export class ListarMidiasOrdemServicoUseCase {
  constructor(private readonly deps: ListarMidiasOrdemServicoDeps) {}

  async execute(ordemServicoId: string): Promise<MidiaOrdemServico[]> {
    return this.deps.midiaOrdemServicoRepository.listByOrdemServicoId(ordemServicoId);
  }
}
