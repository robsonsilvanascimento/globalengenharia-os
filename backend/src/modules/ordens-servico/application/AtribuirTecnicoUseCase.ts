import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import { TECNICO_ATRIBUIDO_OS_EVENT, type TecnicoAtribuidoOS } from '../../../shared/domain/events/TecnicoAtribuidoOS';
import { AjudanteIndisponivelError } from '../domain/errors/AjudanteIndisponivelError';
import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import { TecnicoIndisponivelError } from '../domain/errors/TecnicoIndisponivelError';
import type { HistoricoStatusOSRepository } from '../domain/HistoricoStatusOSRepository';
import type { OrdemServico } from '../domain/OrdemServico';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';
import type { VerificarDisponibilidadeUseCase } from './VerificarDisponibilidadeUseCase';

export interface AtribuirTecnicoInput {
  ordemServicoId: string;
  tecnicoId: string;
  /** Quem esta atribuindo o tecnico (ausente quando a atribuicao e automatica). */
  usuarioId?: string;
  /** Quando informado, agenda a OS para essa data junto com a atribuicao do tecnico. */
  dataAgendada?: Date;
  /** Ajudante (opcional) a ser atribuido junto com o tecnico. */
  ajudanteId?: string;
}

export interface AtribuirTecnicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
  historicoStatusOSRepository: HistoricoStatusOSRepository;
  /** Usado para validar disponibilidade de tecnico/ajudante quando a OS tem dataAgendada. */
  verificarDisponibilidadeUseCase: VerificarDisponibilidadeUseCase;
  /**
   * Opcional para nao quebrar call sites existentes. Quando informado, o
   * evento `TecnicoAtribuidoOS` (e `OSStatusAlterado`, se o status mudou) e
   * publicado apos a persistencia da atribuicao.
   */
  eventBus?: EventBus;
}

/**
 * Atribui um tecnico (e, opcionalmente, um ajudante) a uma Ordem de Servico.
 * Move o status para `atribuida` quando ainda nao estiver nesse status,
 * grava o historico e publica o evento `OSStatusAlterado` somente quando o
 * status efetivamente mudou. Quando a OS tem `dataAgendada` (informada nesta
 * chamada ou ja existente), valida disponibilidade do tecnico e, se
 * informado, do ajudante nesse horario antes de persistir.
 */
export class AtribuirTecnicoUseCase {
  constructor(private readonly deps: AtribuirTecnicoDeps) {}

  async execute(input: AtribuirTecnicoInput): Promise<OrdemServico> {
    const { ordemServicoRepository, historicoStatusOSRepository, verificarDisponibilidadeUseCase, eventBus } =
      this.deps;

    const ordemServico = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!ordemServico) {
      throw new OrdemServicoNaoEncontradaError(input.ordemServicoId);
    }

    const dataAgendadaEfetiva = input.dataAgendada ?? ordemServico.dataAgendada;

    if (dataAgendadaEfetiva) {
      const tecnicoDisponivel = await verificarDisponibilidadeUseCase.verificarUsuarioDisponivel(
        input.tecnicoId,
        dataAgendadaEfetiva,
        input.ordemServicoId,
      );
      if (!tecnicoDisponivel) {
        throw new TecnicoIndisponivelError(input.tecnicoId);
      }

      if (input.ajudanteId) {
        const ajudanteDisponivel = await verificarDisponibilidadeUseCase.verificarUsuarioDisponivel(
          input.ajudanteId,
          dataAgendadaEfetiva,
          input.ordemServicoId,
        );
        if (!ajudanteDisponivel) {
          throw new AjudanteIndisponivelError(input.ajudanteId);
        }
      }
    }

    const statusAnterior = ordemServico.status;
    const statusMudou = statusAnterior !== 'atribuida';

    const ordemAtualizada = await ordemServicoRepository.update(input.ordemServicoId, {
      tecnicoId: input.tecnicoId,
      status: 'atribuida',
      ...(input.dataAgendada !== undefined ? { dataAgendada: input.dataAgendada } : {}),
      ...(input.ajudanteId !== undefined ? { ajudanteId: input.ajudanteId } : {}),
    });

    await historicoStatusOSRepository.create({
      ordemServicoId: input.ordemServicoId,
      statusAnterior,
      statusNovo: 'atribuida',
      alteradoPorUsuarioId: input.usuarioId,
      alteradoPorBot: !input.usuarioId,
      observacao: `Tecnico atribuido: ${input.tecnicoId}`,
    });

    if (eventBus) {
      if (statusMudou) {
        const eventoStatus: OSStatusAlterado = {
          ordemServicoId: ordemAtualizada.id,
          statusAnterior,
          statusNovo: 'atribuida',
          clienteId: ordemAtualizada.clienteId,
          alteradoPor: input.usuarioId ?? 'bot',
          alteradoPorBot: !input.usuarioId,
          timestamp: new Date(),
        };
        eventBus.publish<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, eventoStatus);
      }

      const eventoAtribuicao: TecnicoAtribuidoOS = {
        ordemServicoId: ordemAtualizada.id,
        tecnicoId: input.tecnicoId,
        clienteId: ordemAtualizada.clienteId,
        timestamp: new Date(),
        ...(input.ajudanteId !== undefined ? { ajudanteId: input.ajudanteId } : {}),
      };
      eventBus.publish<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, eventoAtribuicao);
    }

    return ordemAtualizada;
  }
}
