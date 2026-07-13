export interface ItemChecklist {
  id: string;
  templateId: string;
  descricao: string;
  ordem: number;
}

export interface TemplateChecklist {
  id: string;
  categoriaServicoId: string;
  titulo: string;
  ativo: boolean;
  criadoEm: Date;
  itens: ItemChecklist[];
}

export interface RespostaChecklist {
  id: string;
  ordemServicoId: string;
  itemId: string;
  marcado: boolean;
  respondidoPorId: string | null;
  respondidoEm: Date;
}

export interface CriarTemplateInput {
  categoriaServicoId: string;
  titulo: string;
  itens: Array<{ descricao: string; ordem: number }>;
}

export interface ResponderChecklistInput {
  ordemServicoId: string;
  respostas: Array<{ itemId: string; marcado: boolean }>;
  respondidoPorId: string | null;
}
