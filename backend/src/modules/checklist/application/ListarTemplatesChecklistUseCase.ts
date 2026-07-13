import type { ChecklistRepository } from '../domain/ChecklistRepository';
import type { TemplateChecklist } from '../domain/Checklist';

interface Deps {
  checklistRepository: ChecklistRepository;
}

export class ListarTemplatesChecklistUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(): Promise<TemplateChecklist[]> {
    return this.deps.checklistRepository.listTemplates();
  }
}
