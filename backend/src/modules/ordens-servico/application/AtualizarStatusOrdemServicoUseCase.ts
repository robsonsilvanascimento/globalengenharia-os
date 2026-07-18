import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import { ValidarChecklistCompletoUseCase } from '../../checklist/application/ValidarChecklistCompletoUseCase';
import type { ChecklistRepository } from '../../checklist/domain/ChecklistRepository';
import { OrcamentoObrigatorioError } from '../domain/errors/OrcamentoObrigatorioError';
import { OrdemServicoConcorrenciaError } from '../domain/errors/OrdemServicoConcorrenciaError';
import { OrdemServicoNaoEncontradaError } from '../domain/errors/OrdemServicoNaoEncontradaError';
import { TransicaoInvalidaError } from '../domain/errors/TransicaoInvalidaError';
import type { HistoricoStatusOSRepository } from '../domain/HistoricoStatusOSRepository';
import { podeTransicionar, type PapelUsuarioOS } from '../domain/MaquinaEstadosOS';
import type { OrdemServico, StatusOS } from '../domain/OrdemServico';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface AtualizarStatusOrdemServicoInput {
  ordemServicoId: string;
  statusNovo: StatusOS;
  papelUsuario: PapelUsuarioOS;
  usuarioId?: string;
  observacao?: string;
}

export interface AtualizarStatusOrdemServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
  historicoStatusOSRepository: HistoricoStatusOSRepository;
  eventBus: EventBus;
  checklistRepository?: ChecklistRepository;
  /**
   * Indica se a OS tem um orcamento aprovado pelo cliente. Usado para barrar
   * o inicio da execucao (`em_andamento`) de chamados de emergencia sem
   * orcamento aprovado. Opcional: quando ausente, a regra nao e aplicada
   * (ex.: call sites/testes que nao envolvem orcamento).
   */
  orcamentoAprovado?: (ordemServicoId: string) => Promise<boolean>;
}

const STATUS_QUE_FECHAM_OS: readonly StatusOS[] = ['concluida', 'cancelada'];

/**
 * Transiciona o status de uma Ordem de Servico, validando a transicao via
 * `podeTransicionar` (MaquinaEstadosOS). Grava o historico, fecha a OS
 * (fechadoEm) quando o novo status for `concluida`/`cancelada` e publica o
 * evento `OSStatusAlterado` apos persistir.
 *
 * Lanca OrdemServicoNaoEncontradaError se a OS nao existir, e
 * TransicaoInvalidaError se a transicao nao for permitida (nesse caso nada
 * e persistido e nenhum evento e publicado).
 */
export class AtualizarStatusOrdemServicoUseCase {
  constructor(private readonly deps: AtualizarStatusOrdemServicoDeps) {}

  async execute(input: AtualizarStatusOrdemServicoInput): Promise<OrdemServico> {
    const { ordemServicoRepository, historicoStatusOSRepository, eventBus } = this.deps;

    const ordemServico = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!ordemServico) {
      throw new OrdemServicoNaoEncontradaError(input.ordemServicoId);
    }

    const statusAnterior = ordemServico.status;

    if (!podeTransicionar(statusAnterior, input.statusNovo, input.papelUsuario)) {
      throw new TransicaoInvalidaError(statusAnterior, input.statusNovo, input.papelUsuario);
    }

    // Chamado de emergencia so entra em execucao com orcamento aprovado.
    if (
      input.statusNovo === 'em_andamento' &&
      ordemServico.tipoChamado === 'emergencia' &&
      this.deps.orcamentoAprovado
    ) {
      const aprovado = await this.deps.orcamentoAprovado(input.ordemServicoId);
      if (!aprovado) {
        throw new OrcamentoObrigatorioError(input.ordemServicoId);
      }
    }

    if (input.statusNovo === 'concluida' && this.deps.checklistRepository) {
      const validarChecklist = new ValidarChecklistCompletoUseCase({
        checklistRepository: this.deps.checklistRepository,
      });
      await validarChecklist.execute({
        ordemServicoId: input.ordemServicoId,
        categoriaServicoId: ordemServico.categoriaServicoId,
      });
    }

    const fechaOS = STATUS_QUE_FECHAM_OS.includes(input.statusNovo);

    // Compare-and-swap: so aplica se o status no banco ainda for
    // `statusAnterior` (o que foi lido no inicio deste metodo). Evita que
    // duas transicoes concorrentes para a mesma OS (ex.: o bot e um
    // atendente quase ao mesmo tempo) ambas passem pela validacao de
    // `podeTransicionar` com o mesmo estado "antigo" e uma sobrescreva a
    // outra silenciosamente.
    const ordemAtualizada = await ordemServicoRepository.atualizarStatusSeAtual(
      input.ordemServicoId,
      statusAnterior,
      {
        status: input.statusNovo,
        fechadoEm: fechaOS ? new Date() : undefined,
      },
    );

    if (!ordemAtualizada) {
      throw new OrdemServicoConcorrenciaError(input.ordemServicoId);
    }

    await historicoStatusOSRepository.create({
      ordemServicoId: input.ordemServicoId,
      statusAnterior,
      statusNovo: input.statusNovo,
      alteradoPorUsuarioId: input.usuarioId,
      alteradoPorBot: input.papelUsuario === 'bot',
      observacao: input.observacao,
    });

    const evento: OSStatusAlterado = {
      ordemServicoId: ordemAtualizada.id,
      statusAnterior,
      statusNovo: input.statusNovo,
      clienteId: ordemAtualizada.clienteId,
      alteradoPor: input.usuarioId ?? 'bot',
      alteradoPorBot: input.papelUsuario === 'bot',
      timestamp: new Date(),
    };
    eventBus.publish<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, evento);

    return ordemAtualizada;
  }
}
