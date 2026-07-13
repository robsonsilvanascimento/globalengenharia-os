import { DomainError } from './DomainError';

/** Lancado quando o refresh token e invalido/expirado ou o usuario associado nao existe/esta inativo. */
export class TokenInvalidoError extends DomainError {
  constructor(message = 'Token invalido ou expirado') {
    super(message, 'TOKEN_INVALIDO');
  }
}
