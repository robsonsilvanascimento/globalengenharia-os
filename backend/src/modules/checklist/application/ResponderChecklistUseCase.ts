import type { ChecklistRepository } from '../domain/ChecklistRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import type { RespostaChecklist, ResponderChecklistInput } from '../domain/Checklist';
import { NotFoundError } from '../../../shared/http/errors/AppError';

interface Deps {
  checklistRepository: ChecklistRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class ResponderChecklistUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(input: ResponderChecklistInput): Promise<RespostaChecklist[]> {
    const os = await this.deps.ordemServicoRepository.findById(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    return this.deps.checklistRepository.upsertRespostas(input);
  }
}
