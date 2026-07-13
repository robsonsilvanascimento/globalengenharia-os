import type { FotoServicoRealizado } from '../domain/FotoServicoRealizado';
import type { FotoServicoRepository } from '../domain/FotoServicoRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import { NotFoundError } from '../../../shared/http/errors/AppError';

interface Deps {
  fotoServicoRepository: FotoServicoRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class ListarFotosServicoUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(ordemServicoId: string): Promise<FotoServicoRealizado[]> {
    const os = await this.deps.ordemServicoRepository.findById(ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    return this.deps.fotoServicoRepository.findByOrdemServico(ordemServicoId);
  }
}
