import type { AdicionarFotoServicoInput, FotoServicoRealizado } from '../domain/FotoServicoRealizado';
import type { FotoServicoRepository } from '../domain/FotoServicoRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import { BadRequestError, NotFoundError } from '../../../shared/http/errors/AppError';

const MIME_TYPES_PERMITIDOS = ['image/jpeg', 'image/png'] as const;

interface Deps {
  fotoServicoRepository: FotoServicoRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class AdicionarFotoServicoUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(input: AdicionarFotoServicoInput): Promise<FotoServicoRealizado> {
    if (!MIME_TYPES_PERMITIDOS.includes(input.mimeType as (typeof MIME_TYPES_PERMITIDOS)[number])) {
      throw new BadRequestError('mimeType invalido. Permitido: image/jpeg, image/png');
    }

    const os = await this.deps.ordemServicoRepository.findById(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    return this.deps.fotoServicoRepository.create(input);
  }
}
