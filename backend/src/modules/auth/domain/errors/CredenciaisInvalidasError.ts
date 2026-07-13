import { DomainError } from './DomainError';

/** Lancado quando email/senha nao conferem, usuario nao existe ou esta inativo. */
export class CredenciaisInvalidasError extends DomainError {
  constructor(message = 'Email ou senha invalidos') {
    super(message, 'CREDENCIAIS_INVALIDAS');
  }
}
