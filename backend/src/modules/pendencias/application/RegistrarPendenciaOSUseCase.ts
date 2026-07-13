import type { PendenciaOS, RegistrarPendenciaInput } from '../domain/PendenciaOS';
import type { PendenciaOSRepository } from '../domain/PendenciaOSRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import { NotFoundError, ValidationError } from '../../../shared/http/errors/AppError';

export interface RegistrarPendenciaOSUseCaseDeps {
  pendenciaRepository: PendenciaOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class RegistrarPendenciaOSUseCase {
  constructor(private readonly deps: RegistrarPendenciaOSUseCaseDeps) {}

  async execute(input: RegistrarPendenciaInput): Promise<PendenciaOS> {
    if (!input.observacao.trim()) {
      throw new ValidationError('Observacao nao pode ser vazia');
    }

    if (!input.fotos.length) {
      throw new ValidationError('Pelo menos uma foto e obrigatoria');
    }

    const os = await this.deps.ordemServicoRepository.findById(input.ordemServicoId);
    if (!os) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    const pendencia = await this.deps.pendenciaRepository.create(input);

    await this.deps.ordemServicoRepository.update(input.ordemServicoId, { isPendente: true });

    return pendencia;
  }
}
