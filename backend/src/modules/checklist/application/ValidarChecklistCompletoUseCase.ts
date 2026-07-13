import { ValidationError } from '../../../shared/http/errors/AppError';
import type { ChecklistRepository } from '../domain/ChecklistRepository';

export interface ValidarChecklistCompletoInput {
  ordemServicoId: string;
  categoriaServicoId: string;
}

export interface ValidarChecklistCompletoDeps {
  checklistRepository: ChecklistRepository;
}

export class ValidarChecklistCompletoUseCase {
  constructor(private readonly deps: ValidarChecklistCompletoDeps) {}

  async execute(input: ValidarChecklistCompletoInput): Promise<void> {
    const { checklistRepository } = this.deps;

    const template = await checklistRepository.findTemplateByCategoriaServico(input.categoriaServicoId);

    if (!template || template.itens.length === 0) {
      return;
    }

    const respostas = await checklistRepository.findRespostasByOrdemServico(input.ordemServicoId);

    const respostasMarcadasPorItemId = new Map(
      respostas.filter((r) => r.marcado).map((r) => [r.itemId, true]),
    );

    const pendentes = template.itens.filter((item) => !respostasMarcadasPorItemId.has(item.id));

    if (pendentes.length > 0) {
      throw new ValidationError(`Checklist incompleto: ${pendentes.length} item(ns) pendente(s)`);
    }
  }
}
