import { NotFoundError, ValidationError } from '../../../shared/http/errors/AppError';
import type { OrcamentoOS } from '../domain/OrcamentoOS';
import type { OrcamentoOSRepository } from '../domain/OrcamentoOSRepository';

export type DecisaoOrcamento = 'aprovar' | 'recusar';

export interface ResponderOrcamentoResultado {
  orcamento: OrcamentoOS;
  /** true quando esta chamada foi a que efetivou a resposta (para o caller disparar efeitos, ex.: confirmar a OS). */
  efetivou: boolean;
}

export interface ResponderOrcamentoDeps {
  orcamentoRepository: OrcamentoOSRepository;
  /** Chamado quando um orcamento e aprovado, para o caller aplicar efeitos na OS (parte 5). */
  aoAprovar?: (orcamento: OrcamentoOS) => Promise<void>;
}

/**
 * Registra a resposta do cliente (aprovar/recusar) a partir do token do
 * orcamento. Idempotente para a MESMA decisao (reenvio/duplo clique nao
 * quebra), mas rejeita trocar uma decisao ja registrada — mudar de ideia
 * passa pelo atendente, nao por um novo clique no link.
 */
export class ResponderOrcamentoUseCase {
  constructor(private readonly deps: ResponderOrcamentoDeps) {}

  async execute(tokenAprovacao: string, decisao: DecisaoOrcamento): Promise<ResponderOrcamentoResultado> {
    const { orcamentoRepository } = this.deps;

    const orcamento = await orcamentoRepository.buscarPorToken(tokenAprovacao);
    if (!orcamento) throw new NotFoundError('Orcamento nao encontrado');

    const statusDesejado = decisao === 'aprovar' ? 'aprovado' : 'recusado';

    if (orcamento.status !== 'pendente') {
      if (orcamento.status === statusDesejado) {
        return { orcamento, efetivou: false };
      }
      throw new ValidationError(
        `Este orcamento ja foi ${orcamento.status}. Fale com o atendente para reabrir.`,
      );
    }

    const atualizado = await orcamentoRepository.registrarResposta(orcamento.id, statusDesejado, new Date());

    if (statusDesejado === 'aprovado' && this.deps.aoAprovar) {
      await this.deps.aoAprovar(atualizado);
    }

    return { orcamento: atualizado, efetivou: true };
  }
}
