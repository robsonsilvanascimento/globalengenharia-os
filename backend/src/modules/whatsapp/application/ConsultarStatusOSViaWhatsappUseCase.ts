import type { ListarOrdensServicoUseCase } from '../../ordens-servico/application/ListarOrdensServicoUseCase';
import type { OrdemServico, StatusOS } from '../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import type { ComandoResposta } from '../domain/FluxoConversa';
import type { IntencaoConsultaStatus } from '../domain/DetectarIntencaoConsulta';

export interface ConsultarStatusOSViaWhatsappDeps {
  ordemServicoRepository: OrdemServicoRepository;
  listarOrdensServicoUseCase: ListarOrdensServicoUseCase;
}

export interface ConsultarStatusOSViaWhatsappInput {
  clienteId: string;
  intencao: IntencaoConsultaStatus;
}

const STATUS_LABEL: Record<StatusOS, string> = {
  aberta: 'Aberta',
  triagem: 'Em triagem',
  atribuida: 'Atribuida a um tecnico',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peca',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
};

const STATUS_FINALIZADOS: StatusOS[] = ['concluida', 'cancelada'];

function resumirDescricao(descricao: string, tamanhoMaximo = 60): string {
  const texto = descricao.trim();
  return texto.length > tamanhoMaximo ? `${texto.slice(0, tamanhoMaximo).trimEnd()}...` : texto;
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR');
}

function montarMensagemDetalheOS(ordemServico: OrdemServico): string {
  const linhas = [
    `Ordem de Servico ${ordemServico.numero}`,
    `Status: ${STATUS_LABEL[ordemServico.status]}`,
    ordemServico.tecnicoId
      ? 'Tecnico: ja atribuido, aguardando/em atendimento.'
      : 'Tecnico: ainda nao atribuido.',
    `Ultima atualizacao: ${formatarData(ordemServico.atualizadoEm)}`,
  ];

  return linhas.join('\n');
}

/**
 * Monta a(s) resposta(s) de texto para uma consulta de status de OS via
 * WhatsApp, ja identificada como tal por `detectarIntencaoConsulta`.
 * Reaproveita `ListarOrdensServicoUseCase` (filtro por clienteId) e
 * `OrdemServicoRepository.findByNumero` (busca direta por numero
 * informado). Nao faz nenhum envio real — apenas devolve `ComandoResposta[]`.
 */
export class ConsultarStatusOSViaWhatsappUseCase {
  constructor(private readonly deps: ConsultarStatusOSViaWhatsappDeps) {}

  async execute(input: ConsultarStatusOSViaWhatsappInput): Promise<ComandoResposta[]> {
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

    return [{ tipo: 'texto', mensagem: montarMensagemDetalheOS(ordemServico) }];
  }

  private async consultarSemNumero(clienteId: string): Promise<ComandoResposta[]> {
    const resultado = await this.deps.listarOrdensServicoUseCase.execute({ clienteId });
    const ordensAtivas = resultado.itens.filter((ordem) => !STATUS_FINALIZADOS.includes(ordem.status));

    if (ordensAtivas.length === 0) {
      return [
        {
          tipo: 'texto',
          mensagem:
            'Voce nao possui nenhuma Ordem de Servico em aberto no momento. Se quiser, posso abrir uma nova solicitacao — e so me contar o que esta acontecendo.',
        },
      ];
    }

    const unicaOrdemAtiva = ordensAtivas[0];
    if (unicaOrdemAtiva && ordensAtivas.length === 1) {
      return [{ tipo: 'texto', mensagem: montarMensagemDetalheOS(unicaOrdemAtiva) }];
    }

    const linhas = ordensAtivas.map(
      (ordem) => `- ${ordem.numero}: ${resumirDescricao(ordem.descricaoProblema)} (${STATUS_LABEL[ordem.status]})`,
    );

    return [
      {
        tipo: 'texto',
        mensagem: [
          `Voce possui ${ordensAtivas.length} Ordens de Servico em aberto:`,
          ...linhas,
          '',
          'Me informe o numero da OS que deseja consultar em detalhe.',
        ].join('\n'),
      },
    ];
  }
}
