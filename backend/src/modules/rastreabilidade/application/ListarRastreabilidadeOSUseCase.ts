import type { ComponenteInstalado } from '../domain/ComponenteInstalado';
import type { DocumentoOS } from '../domain/DocumentoOS';
import type { ComponenteInstaladoRepository } from '../domain/ComponenteInstaladoRepository';
import type { DocumentoOSRepository } from '../domain/DocumentoOSRepository';

export interface RastreabilidadeOS {
  componentes: (ComponenteInstalado & { documentos: DocumentoOS[] })[];
  documentosSemComponente: DocumentoOS[];
}

export interface ListarRastreabilidadeOSUseCaseDeps {
  componenteInstaladoRepository: ComponenteInstaladoRepository;
  documentoOSRepository: DocumentoOSRepository;
}

export class ListarRastreabilidadeOSUseCase {
  constructor(private readonly deps: ListarRastreabilidadeOSUseCaseDeps) {}

  async execute(ordemServicoId: string): Promise<RastreabilidadeOS> {
    const [componentes, todosDocumentos] = await Promise.all([
      this.deps.componenteInstaladoRepository.findByOrdemServico(ordemServicoId),
      this.deps.documentoOSRepository.findByOrdemServico(ordemServicoId),
    ]);

    const documentosPorComponente = new Map<string, DocumentoOS[]>();
    const documentosSemComponente: DocumentoOS[] = [];

    for (const doc of todosDocumentos) {
      if (doc.componenteInstaladoId) {
        const lista = documentosPorComponente.get(doc.componenteInstaladoId) ?? [];
        lista.push(doc);
        documentosPorComponente.set(doc.componenteInstaladoId, lista);
      } else {
        documentosSemComponente.push(doc);
      }
    }

    return {
      componentes: componentes.map((c) => ({
        ...c,
        documentos: documentosPorComponente.get(c.id) ?? [],
      })),
      documentosSemComponente,
    };
  }
}
