import type { StatusOS } from './OrdemServico';

export type PapelUsuarioOS = 'atendente' | 'tecnico' | 'admin' | 'bot' | 'ajudante';

/**
 * Sequencia de progresso permitida. Cada status so pode avancar para os
 * status listados aqui (sem pular etapas), com excecao do fluxo
 * aguardando_peca <-> em_andamento, que ja esta representado abaixo.
 */
const TRANSICOES_PROGRESSO: Record<StatusOS, readonly StatusOS[]> = {
  aberta: ['triagem'],
  triagem: ['atribuida'],
  atribuida: ['em_andamento'],
  em_andamento: ['aguardando_peca', 'concluida'],
  aguardando_peca: ['em_andamento'],
  concluida: [],
  cancelada: [],
};

/**
 * Transicoes de progresso que o papel `tecnico` pode executar.
 * Tecnico nao pode cancelar nem mover para triagem/atribuida.
 */
const TRANSICOES_PERMITIDAS_TECNICO: ReadonlyArray<readonly [StatusOS, StatusOS]> = [
  ['atribuida', 'em_andamento'],
  ['em_andamento', 'aguardando_peca'],
  ['aguardando_peca', 'em_andamento'],
  ['em_andamento', 'concluida'],
];

/**
 * Define se uma Ordem de Servico pode transicionar de `statusAtual` para
 * `statusNovo`, considerando o papel de quem esta solicitando a transicao.
 *
 * Regras:
 * - Nao ha transicao de um status para ele mesmo (retorna false).
 * - A partir de `concluida` nenhuma transicao automatica e permitida
 *   (reabertura e uma acao explicita fora do escopo desta funcao).
 * - Cancelamento (`statusNovo === 'cancelada'`) e permitido a partir de
 *   qualquer status que nao seja `concluida` nem `cancelada`, e somente
 *   para os papeis `atendente` e `admin`.
 * - Progresso normal segue estritamente a sequencia definida em
 *   `TRANSICOES_PROGRESSO` (nao e permitido pular etapas), exceto o ciclo
 *   `aguardando_peca <-> em_andamento`.
 * - O papel `tecnico` so pode executar as transicoes listadas em
 *   `TRANSICOES_PERMITIDAS_TECNICO`.
 * - O papel `bot` nao executa transicoes de status via esta funcao (ele
 *   apenas cria a Ordem de Servico em `aberta`), portanto sempre retorna
 *   `false`.
 * - O papel `ajudante` nao tem permissao de gerenciar status de OS (apenas
 *   recebe notificacoes de que vai auxiliar um tecnico), portanto tambem
 *   sempre retorna `false`.
 */
export function podeTransicionar(
  statusAtual: StatusOS,
  statusNovo: StatusOS,
  papelUsuario: PapelUsuarioOS,
): boolean {
  if (statusAtual === statusNovo) {
    return false;
  }

  if (statusAtual === 'concluida') {
    return false;
  }

  if (papelUsuario === 'bot' || papelUsuario === 'ajudante') {
    return false;
  }

  const ehCancelamento = statusNovo === 'cancelada';
  if (ehCancelamento) {
    if (statusAtual === 'cancelada') {
      return false;
    }
    return papelUsuario === 'atendente' || papelUsuario === 'admin';
  }

  const proximosStatusValidos = TRANSICOES_PROGRESSO[statusAtual];
  const ehProgressoValido = proximosStatusValidos.includes(statusNovo);
  if (!ehProgressoValido) {
    return false;
  }

  if (papelUsuario === 'tecnico') {
    return TRANSICOES_PERMITIDAS_TECNICO.some(
      ([de, para]) => de === statusAtual && para === statusNovo,
    );
  }

  // atendente / admin podem executar qualquer transicao de progresso valida
  return true;
}
