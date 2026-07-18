import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_CRIADA_EVENT, type OSCriada } from '../../../shared/domain/events/OSCriada';
import type { OrdemServico, OrigemCriacaoOS, PrioridadeOS, TipoChamado } from '../domain/OrdemServico';
import type { HistoricoStatusOSRepository } from '../domain/HistoricoStatusOSRepository';
import type { NumeroOSGenerator } from '../domain/NumeroOSGenerator';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface CriarOrdemServicoInput {
  clienteId: string;
  categoriaServicoId: string;
  descricaoProblema: string;
  enderecoAtendimento?: string;
  prioridade?: PrioridadeOS;
  tipoChamado?: TipoChamado;
  /** Ausente/undefined quando a OS e criada automaticamente pelo bot do WhatsApp. */
  criadoPorUsuarioId?: string;
  criadoVia: OrigemCriacaoOS;
  /** Data/hora de agendamento, quando ja definida no momento da criacao (ex.: fluxo guiado do WhatsApp). */
  dataAgendada?: Date;
}

export interface CriarOrdemServicoDeps {
  ordemServicoRepository: OrdemServicoRepository;
  historicoStatusOSRepository: HistoricoStatusOSRepository;
  numeroOSGenerator: NumeroOSGenerator;
  /**
   * Opcional para nao quebrar call sites existentes (ex.: fluxo de criacao de
   * OS via WhatsApp, fora do escopo deste modulo). Quando informado, o evento
   * `OSCriada` e publicado apos a persistencia da OS e do historico inicial.
   */
  eventBus?: EventBus;
}

/**
 * Cria uma nova Ordem de Servico com status inicial `aberta`, gerando um
 * numero unico (formato OS-{ano}-{sequencial}) e registrando a primeira
 * entrada no historico de status (statusAnterior nulo -> 'aberta'). Quando
 * `eventBus` e informado, publica `OSCriada` apos persistir a OS e o
 * historico (ver `entrega-documentos/application/EntregarPdfOSListener.ts`).
 */
export class CriarOrdemServicoUseCase {
  constructor(private readonly deps: CriarOrdemServicoDeps) {}

  async execute(input: CriarOrdemServicoInput): Promise<OrdemServico> {
    const { ordemServicoRepository, historicoStatusOSRepository, numeroOSGenerator, eventBus } = this.deps;

    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const numero = await numeroOSGenerator.gerarNumero(ano, mes);

    const ordemServico = await ordemServicoRepository.create({
      numero,
      clienteId: input.clienteId,
      categoriaServicoId: input.categoriaServicoId,
      descricaoProblema: input.descricaoProblema,
      enderecoAtendimento: input.enderecoAtendimento,
      prioridade: input.prioridade ?? 'normal',
      status: 'aberta',
      tipoChamado: input.tipoChamado ?? 'servico',
      criadoPorUsuarioId: input.criadoPorUsuarioId,
      criadoVia: input.criadoVia,
      dataAgendada: input.dataAgendada,
    });

    await historicoStatusOSRepository.create({
      ordemServicoId: ordemServico.id,
      statusAnterior: undefined,
      statusNovo: 'aberta',
      alteradoPorUsuarioId: input.criadoPorUsuarioId,
      alteradoPorBot: !input.criadoPorUsuarioId,
      observacao: undefined,
    });

    if (eventBus) {
      const evento: OSCriada = {
        ordemServicoId: ordemServico.id,
        clienteId: ordemServico.clienteId,
        timestamp: new Date(),
      };
      eventBus.publish<OSCriada>(OS_CRIADA_EVENT, evento);
    }

    return ordemServico;
  }
}
