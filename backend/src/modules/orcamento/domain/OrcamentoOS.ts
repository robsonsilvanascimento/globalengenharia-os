export type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado';

/** Item detalhado do orcamento (ex.: mao de obra, deslocamento, material). */
export interface ItemOrcamento {
  descricao: string;
  valor: number;
}

export interface OrcamentoOS {
  id: string;
  ordemServicoId: string;
  status: StatusOrcamento;
  valorTotal: number;
  itens: ItemOrcamento[];
  observacao: string | null;
  tokenAprovacao: string;
  enviadoEm: Date | null;
  respondidoEm: Date | null;
  criadoPorId: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CriarOrcamentoInput {
  ordemServicoId: string;
  itens: ItemOrcamento[];
  observacao?: string;
  criadoPorId: string;
}

/** Soma dos itens do orcamento (fonte unica da verdade do valor total). */
export function calcularValorTotal(itens: ItemOrcamento[]): number {
  const total = itens.reduce((soma, item) => soma + item.valor, 0);
  // Evita ruido de ponto flutuante (ex.: 0.1 + 0.2) em valores monetarios.
  return Math.round(total * 100) / 100;
}
