import { DomainError } from './DomainError';

/** Lancado quando o token de redefinicao de senha e invalido, ja usado ou expirado. */
export class TokenResetInvalidoError extends DomainError {
  constructor(message = 'Token de redefinicao de senha invalido ou expirado') {
    super(message, 'TOKEN_RESET_INVALIDO');
  }
}
