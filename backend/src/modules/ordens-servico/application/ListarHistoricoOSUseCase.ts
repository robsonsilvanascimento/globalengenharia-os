import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import type {
  HistoricoStatusOSRepository,
  ListarHistoricoResultado,
} from '../domain/HistoricoStatusOSRepository';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface ListarHistoricoOSInput {
  ordemServicoId: string;
  page?: number;
  pageSize?: number;
}

export interface ListarHistoricoOSDeps {
  ordemServicoRepository: OrdemServicoRepository;
  historicoStatusOSRepository: HistoricoStatusOSRepository;
}

const PAGE_SIZE_PADRAO = 50;

/**
 * Lista o historico de status de uma Ordem de Servico, paginado. Lanca
 * OrdemServicoNaoEncontradaError se a OS nao existir.
 */
export class ListarHistoricoOSUseCase {
  constructor(private readonly deps: ListarHistoricoOSDeps) {}

  async execute(input: ListarHistoricoOSInput): Promise<ListarHistoricoResultado> {
    const { ordemServicoRepository, historicoStatusOSRepository } = this.deps;

    const ordemServico = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!ordemServico) {
      throw new OrdemServicoNaoEncontradaError(input.ordemServicoId);
    }

    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : PAGE_SIZE_PADRAO;

    return historicoStatusOSRepository.listByOrdemServicoId(input.ordemServicoId, { page, pageSize });
  }
}
