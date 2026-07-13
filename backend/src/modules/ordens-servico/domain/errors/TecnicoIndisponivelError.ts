import { DomainError } from './DomainError';

/** Lancado quando o tecnico informado ja possui outra OS agendada no mesmo horario. */
export class TecnicoIndisponivelError extends DomainError {
  constructor(tecnicoId: string) {
    super(`Tecnico "${tecnicoId}" nao esta disponivel no horario agendado`, 'TECNICO_INDISPONIVEL');
  }
}
