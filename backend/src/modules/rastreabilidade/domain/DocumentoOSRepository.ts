import type { DocumentoOS, AdicionarDocumentoOSInput } from './DocumentoOS';

export interface DocumentoOSRepository {
  create(input: AdicionarDocumentoOSInput): Promise<DocumentoOS>;
  findById(id: string): Promise<DocumentoOS | null>;
  findByOrdemServico(ordemServicoId: string): Promise<DocumentoOS[]>;
  findByComponente(componenteInstaladoId: string): Promise<DocumentoOS[]>;
  deactivate(id: string): Promise<void>;
}
