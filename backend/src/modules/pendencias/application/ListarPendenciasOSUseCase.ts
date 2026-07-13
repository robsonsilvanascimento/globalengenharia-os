import type { PendenciaOS } from '../domain/PendenciaOS';
import type { PendenciaOSRepository } from '../domain/PendenciaOSRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import { NotFoundError } from '../../../shared/http/errors/AppError';

export interface ListarPendenciasOSUseCaseDeps {
  pendenciaRepository: PendenciaOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class ListarPendenciasOSUseCase {
  constructor(private readonly deps: ListarPendenciasOSUseCaseDeps) {}

  async execute(ordemServicoId: string): Promise<PendenciaOS[]> {
    const os = await this.deps.ordemServicoRepository.findById(ordemServicoId);
    if (!os) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    return this.deps.pendenciaRepository.findByOrdemServico(ordemServicoId);
  }
}
