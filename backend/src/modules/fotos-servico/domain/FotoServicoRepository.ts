import type { AdicionarFotoServicoInput, FotoServicoRealizado } from './FotoServicoRealizado';

export interface FotoServicoRepository {
  create(input: AdicionarFotoServicoInput): Promise<FotoServicoRealizado>;
  findByOrdemServico(ordemServicoId: string): Promise<FotoServicoRealizado[]>;
}
