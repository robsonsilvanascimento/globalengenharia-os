import type { EstimativaCustoOS } from '../domain/EstimativaCustoOS';
import type { EstimativaCustoOSRepository } from '../domain/EstimativaCustoOSRepository';

export interface ObterEstimativaCustoDeps {
  estimativaCustoOSRepository: EstimativaCustoOSRepository;
}

/**
 * Busca a estimativa de custo de uma OS. Retorna `null` quando ainda nao foi
 * calculada — isso nao e um erro, apenas um estado normal da OS.
 */
export class ObterEstimativaCustoUseCase {
  constructor(private readonly deps: ObterEstimativaCustoDeps) {}

  async execute(ordemServicoId: string): Promise<EstimativaCustoOS | null> {
    return this.deps.estimativaCustoOSRepository.findByOrdemServicoId(ordemServicoId);
  }
}
