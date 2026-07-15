import type { ListarOrdensServicoUseCase } from '../../ordens-servico/application/ListarOrdensServicoUseCase';
import type { OrdemServico } from '../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import type { ComandoResposta } from '../domain/FluxoConversa';
import type { IntencaoPagamento } from '../domain/DetectarIntencaoPagamento';

/** Situacao de pagamento de uma OS concluida, resolvida pelo modulo `pagamento`. */
export type ResultadoPagamentoOS =
  | { statusPagamento: 'pago' }
  | { statusPagamento: 'pendente'; valor: number; pixCopiaECola: string }
  | { statusPagamento: 'sem_valor' };

/**
 * Funcao injetada (implementada no modulo `pagamento`) que resolve a
 * situacao de pagamento de uma OS ja concluida: gera o Pix on-demand quando
 * ainda nao existe um pendente (reaproveitando o mesmo fluxo usado pela
 * geracao automatica ao concluir a OS), ou apenas informa que ja esta paga.
 * Mantem o modulo `whatsapp` desacoplado de Mercado Pago/Prisma.
 */
export type BuscarPagamentoDaOSFn = (ordemServico: OrdemServico) => Promise<ResultadoPagamentoOS>;

export interface ConsultarPagamentoViaWhatsappDeps {
  ordemServicoRepository: OrdemServicoRepository;
  listarOrdensServicoUseCase: ListarOrdensServicoUseCase;
  buscarPagamentoDaOS: BuscarPagamentoDaOSFn;
}

export interface ConsultarPagamentoViaWhatsappInput {
  clienteId: string;
  intencao: IntencaoPagamento;
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Monta a(s) resposta(s) de texto para uma consulta sobre pagamento/Pix via
 * WhatsApp, ja identificada como tal por `detectarIntencaoPagamento`.
 * Reaproveita `OrdemServicoRepository.findByNumero` e
 * `ListarOrdensServicoUseCase` (mesma base da consulta de status), e delega
 * a situacao de pagamento propriamente dita a `buscarPagamentoDaOS`. Nao faz
 * nenhum envio real — apenas devolve `ComandoResposta[]`.
 */
export class ConsultarPagamentoViaWhatsappUseCase {
  constructor(private readonly deps: ConsultarPagamentoViaWhatsappDeps) {}

  async execute(input: ConsultarPagamentoViaWhatsappInput): Promise<ComandoResposta[]> {
    const { clienteId, intencao } = input;

    if (intencao.numeroOS) {
      return this.consultarPorNumero(clienteId, intencao.numeroOS);
    }

    return this.consultarSemNumero(clienteId);
  }

  private async consultarPorNumero(clienteId: string, numeroOS: string): Promise<ComandoResposta[]> {
    const ordemServico = await this.deps.ordemServicoRepository.findByNumero(numeroOS);

    if (!ordemServico || ordemServico.clienteId !== clienteId) {
      return [
        {
          tipo: 'texto',
          mensagem:
            'Nao encontramos nenhuma Ordem de Servico com esse numero associada ao seu cadastro. Confira o numero e tente novamente.',
        },
      ];
    }

    return this.montarRespostaPagamento(ordemServico);
  }

  private async consultarSemNumero(clienteId: string): Promise<ComandoResposta[]> {
    const resultado = await this.deps.listarOrdensServicoUseCase.execute({ clienteId });
    const ordemConcluida = resultado.itens.find((ordem) => ordem.status === 'concluida');

    if (!ordemConcluida) {
      return [
        {
          tipo: 'texto',
          mensagem:
            'Voce nao possui nenhuma Ordem de Servico concluida no momento para consulta de pagamento. Se for sobre uma OS especifica, me informe o numero.',
        },
      ];
    }

    return this.montarRespostaPagamento(ordemConcluida);
  }

  private async montarRespostaPagamento(ordemServico: OrdemServico): Promise<ComandoResposta[]> {
    if (ordemServico.status !== 'concluida') {
      return [
        {
          tipo: 'texto',
          mensagem: `Sua Ordem de Servico ${ordemServico.numero} ainda esta em andamento. O valor sera cobrado assim que o servico for concluido.`,
        },
      ];
    }

    const pagamento = await this.deps.buscarPagamentoDaOS(ordemServico);

    if (pagamento.statusPagamento === 'pago') {
      return [
        {
          tipo: 'texto',
          mensagem: `Sua Ordem de Servico ${ordemServico.numero} ja esta paga. Obrigado!`,
        },
      ];
    }

    if (pagamento.statusPagamento === 'sem_valor') {
      return [
        {
          tipo: 'texto',
          mensagem: `Sua Ordem de Servico ${ordemServico.numero} foi concluida, mas o valor ainda esta sendo definido pela nossa equipe. Assim que estiver pronto, enviaremos o Pix para pagamento.`,
        },
      ];
    }

    return [
      {
        tipo: 'texto',
        mensagem: [
          `Ordem de Servico ${ordemServico.numero}`,
          `Valor: ${formatarValor(pagamento.valor)}`,
          'Pague via Pix (copia e cola):',
          pagamento.pixCopiaECola,
        ].join('\n'),
      },
    ];
  }
}
