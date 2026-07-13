import { DomainError } from './DomainError';

/** Lancado quando um Cliente com o id informado nao existe. */
export class ClienteNaoEncontradoError extends DomainError {
  constructor(clienteId: string) {
    super(`Cliente "${clienteId}" nao encontrado`, 'CLIENTE_NAO_ENCONTRADO');
  }
}
