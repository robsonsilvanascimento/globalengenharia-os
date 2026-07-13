import type {
  CriarTemplateInput,
  RespostaChecklist,
  ResponderChecklistInput,
  TemplateChecklist,
} from './Checklist';

export interface ChecklistRepository {
  createTemplate(input: CriarTemplateInput): Promise<TemplateChecklist>;
  findTemplateByCategoriaServico(categoriaServicoId: string): Promise<TemplateChecklist | null>;
  listTemplates(): Promise<TemplateChecklist[]>;
  upsertRespostas(input: ResponderChecklistInput): Promise<RespostaChecklist[]>;
  findRespostasByOrdemServico(ordemServicoId: string): Promise<RespostaChecklist[]>;
}
