import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_REAGENDADA_EVENT, type OSReagendada } from '../../../shared/domain/events/OSReagendada';
import type { OrdemServico, PrioridadeOS } from '../domain/OrdemServico';
import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface AtualizarOrdemServicoInput {
  ordemServicoId: string;
  descricaoProblema?: string;
  enderecoAtendimento?: string;
  prioridade?: PrioridadeOS;
  dataAgendada?: Date;
}

export interface AtualizarOrdemServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
  /** Opcional: quando fornecido, publica OSReagendada ao alterar dataAgendada. */
  eventBus?: EventBus;
}

/**
 * Edita os campos gerais de uma Ordem de Servico (descricaoProblema,
 * enderecoAtendimento, prioridade, dataAgendada). Nao mexe em status —
 * transicoes de status sao responsabilidade de AtualizarStatusOrdemServicoUseCase.
 */
export class AtualizarOrdemServicoUseCase {
  constructor(private readonly deps: AtualizarOrdemServicoDeps) {}

  async execute(input: AtualizarOrdemServicoInput): Promise<OrdemServico> {
    const { ordemServicoRepository, eventBus } = this.deps;

    const existente = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!existente) {
      throw new OrdemServicoNaoEncontradaError(input.ordemServicoId);
    }

    const atualizada = await ordemServicoRepository.update(input.ordemServicoId, {
      descricaoProblema: input.descricaoProblema,
      enderecoAtendimento: input.enderecoAtendimento,
      prioridade: input.prioridade,
      dataAgendada: input.dataAgendada,
    });

    if (eventBus && input.dataAgendada && atualizada.tecnicoId) {
      const evento: OSReagendada = {
        ordemServicoId: atualizada.id,
        tecnicoId: atualizada.tecnicoId,
        dataAgendada: input.dataAgendada,
        timestamp: new Date(),
      };
      eventBus.publish<OSReagendada>(OS_REAGENDADA_EVENT, evento);
    }

    return atualizada;
  }
}
