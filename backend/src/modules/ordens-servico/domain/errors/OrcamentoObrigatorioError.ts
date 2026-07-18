import { DomainError } from './DomainError';

/**
 * Lancado quando se tenta iniciar a execucao de uma OS de emergencia sem um
 * orcamento aprovado pelo cliente. Em chamados de emergencia o orcamento
 * aprovado e pre-requisito para colocar a OS em andamento.
 */
export class OrcamentoObrigatorioError extends DomainError {
  constructor(ordemServicoId: string) {
    super(
      `A OS ${ordemServicoId} e um chamado de emergencia e exige orcamento aprovado antes de iniciar a execucao`,
      'ORCAMENTO_OBRIGATORIO',
    );
  }
}
