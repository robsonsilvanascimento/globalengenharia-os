import type { HistoricoOSItem, OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';

export interface ListarHistoricoOSClienteInput {
  clienteId: string;
  excluirOsId?: string;
}

export interface ListarHistoricoOSClienteDeps {
  ordemServicoRepository: OrdemServicoRepository;
}

export class ListarHistoricoOSClienteUseCase {
  constructor(private readonly deps: ListarHistoricoOSClienteDeps) {}

  async execute(input: ListarHistoricoOSClienteInput): Promise<HistoricoOSItem[]> {
    return this.deps.ordemServicoRepository.findByClienteId(input.clienteId, input.excluirOsId);
  }
}
