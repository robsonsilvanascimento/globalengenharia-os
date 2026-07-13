import type { StatusOS } from '../domain/OrdemServico';
import type {
  ListarOrdensServicoResultado,
  OrdemServicoRepository,
} from '../domain/OrdemServicoRepository';

export interface ListarOrdensServicoInput {
  status?: StatusOS;
  tecnicoId?: string;
  clienteId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListarOrdensServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
}

const PAGE_SIZE_PADRAO = 20;

/** Lista Ordens de Servico com filtros opcionais (status, tecnico, cliente) e paginacao. */
export class ListarOrdensServicoUseCase {
  constructor(private readonly deps: ListarOrdensServicoDeps) {}

  async execute(input: ListarOrdensServicoInput = {}): Promise<ListarOrdensServicoResultado> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : PAGE_SIZE_PADRAO;

    return this.deps.ordemServicoRepository.list(
      {
        status: input.status,
        tecnicoId: input.tecnicoId,
        clienteId: input.clienteId,
      },
      { page, pageSize },
    );
  }
}
