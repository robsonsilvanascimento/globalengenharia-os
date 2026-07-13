import { DomainError } from './DomainError';
import type { StatusOS } from '../OrdemServico';
import type { PapelUsuarioOS } from '../MaquinaEstadosOS';

/** Lancado quando uma transicao de status nao e permitida pela maquina de estados (MaquinaEstadosOS). */
export class TransicaoInvalidaError extends DomainError {
  constructor(statusAtual: StatusOS, statusNovo: StatusOS, papelUsuario: PapelUsuarioOS) {
    super(
      `Transicao de status invalida: "${statusAtual}" -> "${statusNovo}" nao e permitida para o papel "${papelUsuario}"`,
      'TRANSICAO_INVALIDA',
    );
  }
}
