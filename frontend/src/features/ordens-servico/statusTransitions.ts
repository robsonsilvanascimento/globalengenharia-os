import type { PapelUsuario, PrioridadeOrdemServico, StatusOrdemServico } from '../../types/api';

/** Human-readable labels for each OS status, shared by the detail page and the Timeline. */
export const STATUS_LABELS: Record<StatusOrdemServico, string> = {
  aberta: 'Aberta',
  triagem: 'Triagem',
  atribuida: 'Atribuída',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PRIORIDADE_LABELS: Record<PrioridadeOrdemServico, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

/**
 * Full transition matrix mirroring the backend rule:
 * aberta -> triagem -> atribuida -> em_andamento <-> aguardando_peca -> concluida,
 * with cancellation allowed from any non-terminal status. Nothing is possible
 * from `concluida` or `cancelada` (terminal statuses).
 */
const FULL_TRANSITIONS: Record<StatusOrdemServico, StatusOrdemServico[]> = {
  aberta: ['triagem', 'cancelada'],
  triagem: ['atribuida', 'cancelada'],
  atribuida: ['em_andamento', 'cancelada'],
  em_andamento: ['aguardando_peca', 'concluida', 'cancelada'],
  aguardando_peca: ['em_andamento', 'cancelada'],
  concluida: [],
  cancelada: [],
};

/**
 * `tecnico` role only sees the transitions relevant to executing the
 * service: it can never cancel nor move an OS through triagem/atribuicao.
 */
const TECNICO_TRANSITIONS: Record<StatusOrdemServico, StatusOrdemServico[]> = {
  aberta: [],
  triagem: [],
  atribuida: ['em_andamento'],
  em_andamento: ['aguardando_peca', 'concluida'],
  aguardando_peca: ['em_andamento'],
  concluida: [],
  cancelada: [],
};

/** Returns the statuses that `papel` may move `status` into. */
export function getValidTransitions(
  status: StatusOrdemServico,
  papel: PapelUsuario | null,
): StatusOrdemServico[] {
  if (papel === 'tecnico') {
    return TECNICO_TRANSITIONS[status];
  }
  return FULL_TRANSITIONS[status];
}

/** Terminal statuses can never transition anywhere, regardless of role. */
export function isStatusTerminal(status: StatusOrdemServico): boolean {
  return status === 'concluida' || status === 'cancelada';
}
