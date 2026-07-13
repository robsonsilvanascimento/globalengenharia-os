import type { ChecklistRepository } from '../domain/ChecklistRepository';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import type { RespostaChecklist, TemplateChecklist } from '../domain/Checklist';
import { NotFoundError } from '../../../shared/http/errors/AppError';

interface Deps {
  checklistRepository: ChecklistRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

interface Input {
  ordemServicoId: string;
  categoriaServicoId: string;
}

interface Output {
  template: TemplateChecklist | null;
  respostas: RespostaChecklist[];
}

export class BuscarChecklistOSUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(input: Input): Promise<Output> {
    const os = await this.deps.ordemServicoRepository.findById(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    const [template, respostas] = await Promise.all([
      this.deps.checklistRepository.findTemplateByCategoriaServico(input.categoriaServicoId),
      this.deps.checklistRepository.findRespostasByOrdemServico(input.ordemServicoId),
    ]);

    return { template, respostas };
  }
}
