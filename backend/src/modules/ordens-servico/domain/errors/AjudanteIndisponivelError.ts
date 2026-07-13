import { DomainError } from './DomainError';

/** Lancado quando o ajudante informado ja possui outra OS agendada no mesmo horario. */
export class AjudanteIndisponivelError extends DomainError {
  constructor(ajudanteId: string) {
    super(`Ajudante "${ajudanteId}" nao esta disponivel no horario agendado`, 'AJUDANTE_INDISPONIVEL');
  }
}
