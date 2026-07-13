import type { ChecklistRepository } from '../domain/ChecklistRepository';
import type { CriarTemplateInput, TemplateChecklist } from '../domain/Checklist';

interface Deps {
  checklistRepository: ChecklistRepository;
}

export class CriarTemplateChecklistUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(input: CriarTemplateInput): Promise<TemplateChecklist> {
    return this.deps.checklistRepository.createTemplate(input);
  }
}
