import { randomUUID } from 'node:crypto';
import type { ComponenteInstalado, CriarComponenteInstaladoInput } from '../domain/ComponenteInstalado';
import type { ComponenteInstaladoRepository } from '../domain/ComponenteInstaladoRepository';

export interface RegistrarComponenteUseCaseDeps {
  componenteInstaladoRepository: ComponenteInstaladoRepository;
}

export class RegistrarComponenteUseCase {
  constructor(private readonly deps: RegistrarComponenteUseCaseDeps) {}

  async execute(input: CriarComponenteInstaladoInput): Promise<ComponenteInstalado> {
    const garantiaExpiraEm =
      input.garantiaMeses != null
        ? (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + input.garantiaMeses!);
            return d;
          })()
        : undefined;

    return this.deps.componenteInstaladoRepository.create({
      ...input,
      garantiaMeses: input.garantiaMeses,
    });
  }
}
