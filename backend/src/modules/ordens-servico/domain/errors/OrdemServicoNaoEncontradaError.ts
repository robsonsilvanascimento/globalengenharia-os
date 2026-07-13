import { DomainError } from './DomainError';

/** Lancado quando uma Ordem de Servico com o id informado nao existe. */
export class OrdemServicoNaoEncontradaError extends DomainError {
  constructor(ordemServicoId: string) {
    super(`Ordem de servico "${ordemServicoId}" nao encontrada`, 'ORDEM_SERVICO_NAO_ENCONTRADA');
  }
}
