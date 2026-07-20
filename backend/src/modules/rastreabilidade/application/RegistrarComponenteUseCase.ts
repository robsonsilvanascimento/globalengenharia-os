import type { ComponenteInstalado, CriarComponenteInstaladoInput } from '../domain/ComponenteInstalado';
import type { ComponenteInstaladoRepository } from '../domain/ComponenteInstaladoRepository';

export interface RegistrarComponenteUseCaseDeps {
  componenteInstaladoRepository: ComponenteInstaladoRepository;
}

/** Calculo e persistencia de garantiaExpiraEm ficam a cargo do repositorio (a partir de garantiaMeses). */
export class RegistrarComponenteUseCase {
  constructor(private readonly deps: RegistrarComponenteUseCaseDeps) {}

  async execute(input: CriarComponenteInstaladoInput): Promise<ComponenteInstalado> {
    return this.deps.componenteInstaladoRepository.create({
      ...input,
      garantiaMeses: input.garantiaMeses,
    });
  }
}
