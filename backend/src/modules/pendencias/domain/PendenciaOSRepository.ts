import type { PendenciaOS, RegistrarPendenciaInput } from './PendenciaOS';

export interface PendenciaOSRepository {
  create(input: RegistrarPendenciaInput): Promise<PendenciaOS>;
  findByOrdemServico(ordemServicoId: string): Promise<PendenciaOS[]>;
}
