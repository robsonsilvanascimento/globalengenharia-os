import type { DocumentoOS, AdicionarDocumentoOSInput } from '../domain/DocumentoOS';
import type { DocumentoOSRepository } from '../domain/DocumentoOSRepository';
import type { ComponenteInstaladoRepository } from '../domain/ComponenteInstaladoRepository';
import { NotFoundError } from '../../../shared/http/errors/AppError';

export interface AdicionarDocumentoOSUseCaseDeps {
  documentoOSRepository: DocumentoOSRepository;
  componenteInstaladoRepository: ComponenteInstaladoRepository;
}

export class AdicionarDocumentoOSUseCase {
  constructor(private readonly deps: AdicionarDocumentoOSUseCaseDeps) {}

  async execute(input: AdicionarDocumentoOSInput): Promise<DocumentoOS> {
    if (input.componenteInstaladoId) {
      const componente = await this.deps.componenteInstaladoRepository.findById(
        input.componenteInstaladoId,
      );
      if (!componente) {
        throw new NotFoundError('Componente instalado não encontrado');
      }
    }

    return this.deps.documentoOSRepository.create(input);
  }
}
