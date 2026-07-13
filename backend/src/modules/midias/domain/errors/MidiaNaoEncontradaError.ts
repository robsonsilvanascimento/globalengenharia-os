import { DomainError } from './DomainError';

/** Lancado quando uma MidiaOrdemServico com o id informado nao existe. */
export class MidiaNaoEncontradaError extends DomainError {
  constructor(midiaId: string) {
    super(`Midia "${midiaId}" nao encontrada`, 'MIDIA_NAO_ENCONTRADA');
  }
}
