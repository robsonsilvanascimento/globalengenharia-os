import { DomainError } from './DomainError';

/**
 * Lancado quando o status da OS mudou entre a leitura e a escrita desta
 * transicao (ex.: duas requisicoes concorrentes, ou o bot e um atendente
 * transicionando a mesma OS quase ao mesmo tempo). Quem chamar deve tratar
 * como conflito e reler o estado atual antes de tentar de novo.
 */
export class OrdemServicoConcorrenciaError extends DomainError {
  constructor(ordemServicoId: string) {
    super(
      `A Ordem de Servico ${ordemServicoId} foi alterada por outra requisicao antes desta transicao ser aplicada`,
      'CONFLITO_CONCORRENCIA',
    );
  }
}
