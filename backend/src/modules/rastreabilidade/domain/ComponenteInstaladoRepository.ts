import type { ComponenteInstalado, CriarComponenteInstaladoInput } from './ComponenteInstalado';

export interface ComponenteInstaladoRepository {
  create(input: CriarComponenteInstaladoInput): Promise<ComponenteInstalado>;
  findById(id: string): Promise<ComponenteInstalado | null>;
  findByOrdemServico(ordemServicoId: string): Promise<ComponenteInstalado[]>;
  findByNumeroSerie(numeroSerie: string): Promise<ComponenteInstalado[]>;
}
