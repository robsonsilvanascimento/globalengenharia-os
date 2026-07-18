import { NotFoundError } from '../../../shared/http/errors/AppError';
import type { OrcamentoOS } from '../domain/OrcamentoOS';
import type { OrcamentoOSRepository } from '../domain/OrcamentoOSRepository';

export class ObterOrcamentoUseCase {
  constructor(private readonly deps: { orcamentoRepository: OrcamentoOSRepository }) {}

  async execute(ordemServicoId: string): Promise<OrcamentoOS> {
    const orcamento = await this.deps.orcamentoRepository.buscarPorOrdemServico(ordemServicoId);
    if (!orcamento) throw new NotFoundError('Orcamento nao encontrado para esta OS');
    return orcamento;
  }
}
