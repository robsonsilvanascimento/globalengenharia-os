import type { SolicitacaoAtendimento, StatusSolicitacaoAtendimento } from '../domain/SolicitacaoAtendimento';
import type { SolicitacaoAtendimentoRepository } from '../domain/SolicitacaoAtendimentoRepository';

export interface ListarSolicitacoesAtendimentoDeps {
  solicitacaoAtendimentoRepository: SolicitacaoAtendimentoRepository;
}

/**
 * Lista solicitacoes de atendimento humano filtradas por status. Quando
 * nenhum status for informado, retorna somente as pendentes (fila de
 * trabalho padrao do atendente).
 */
export class ListarSolicitacoesAtendimentoUseCase {
  constructor(private readonly deps: ListarSolicitacoesAtendimentoDeps) {}

  async execute(status?: StatusSolicitacaoAtendimento): Promise<SolicitacaoAtendimento[]> {
    const { solicitacaoAtendimentoRepository } = this.deps;

    return solicitacaoAtendimentoRepository.list(status ?? 'pendente');
  }
}
