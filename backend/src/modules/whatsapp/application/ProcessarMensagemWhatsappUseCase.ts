import type { ClienteRepository } from '../../clientes/domain/ClienteRepository';
import type { CategoriaServicoRepository } from '../../categorias-servico/domain/CategoriaServicoRepository';
import type { CriarOrdemServicoUseCase } from '../../ordens-servico/application/CriarOrdemServicoUseCase';
import type { VerificarDisponibilidadeUseCase } from '../../ordens-servico/application/VerificarDisponibilidadeUseCase';
import type { OrdemServico } from '../../ordens-servico/domain/OrdemServico';
import type { UsuarioRepository } from '../../auth/domain/UsuarioRepository';
import type { BuscarRespostaFaqUseCase } from '../../faq/application/BuscarRespostaFaqUseCase';
import type { CriarSolicitacaoAtendimentoUseCase } from '../../atendimento-humano/application/CriarSolicitacaoAtendimentoUseCase';
import type { ConsultarStatusOSViaWhatsappUseCase } from './ConsultarStatusOSViaWhatsappUseCase';
import type { ConsultarPagamentoViaWhatsappUseCase } from './ConsultarPagamentoViaWhatsappUseCase';
import type { ConversaWhatsapp } from '../domain/ConversaWhatsapp';
import type { ConversaWhatsappRepository } from '../domain/ConversaWhatsappRepository';
import { detectarIntencaoConsulta } from '../domain/DetectarIntencaoConsulta';
import { detectarIntencaoPagamento } from '../domain/DetectarIntencaoPagamento';
import { detectarPerguntaGeral } from '../domain/DetectarPerguntaGeral';
import {
  processarFluxoConversa,
  type ComandoResposta,
  type ContextoConversaWhatsapp,
  type EstadoFluxoConversa,
} from '../domain/FluxoConversa';

export interface ProcessarMensagemWhatsappDeps {
  conversaWhatsappRepository: ConversaWhatsappRepository;
  clienteRepository: ClienteRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
  criarOrdemServicoUseCase: CriarOrdemServicoUseCase;
  verificarDisponibilidadeUseCase: VerificarDisponibilidadeUseCase;
  usuarioRepository: UsuarioRepository;
  consultarStatusOSViaWhatsappUseCase: ConsultarStatusOSViaWhatsappUseCase;
  consultarPagamentoViaWhatsappUseCase: ConsultarPagamentoViaWhatsappUseCase;
  buscarRespostaFaqUseCase: BuscarRespostaFaqUseCase;
  criarSolicitacaoAtendimentoUseCase: CriarSolicitacaoAtendimentoUseCase;
}

export interface ProcessarMensagemWhatsappInput {
  telefone: string;
  mensagemRecebida: string;
}

export interface ProcessarMensagemWhatsappResultado {
  conversa: ConversaWhatsapp;
  respostasParaEnviar: ComandoResposta[];
  ordemServicoCriada?: OrdemServico;
}

/**
 * Orquestra o processamento de uma mensagem recebida via WhatsApp:
 * identifica (ou cria) o Cliente pelo telefone, busca/cria a ConversaWhatsapp
 * correspondente, delega o calculo da transicao para `processarFluxoConversa`
 * (dominio puro), persiste o novo estado/contexto e, quando o fluxo chega em
 * `os_criada`, cria a Ordem de Servico com os dados coletados.
 *
 * Nao executa nenhum envio real ao WhatsApp — apenas retorna os
 * `ComandoResposta[]` que a infraestrutura (worker) deve executar via
 * `MetaCloudApiClient`.
 *
 * Quando o estado da conversa e `inicio` e a mensagem nao expressa intencao
 * de consulta de status, mas parece uma pergunta/duvida geral
 * (`detectarPerguntaGeral`), a mensagem e desviada para a FAQ
 * (`BuscarRespostaFaqUseCase`, via IA) em vez de iniciar o fluxo guiado de
 * abertura de OS; se a FAQ nao souber responder, cria uma
 * `SolicitacaoAtendimento` pendente (`CriarSolicitacaoAtendimentoUseCase`)
 * para escalonamento humano.
 *
 * NOTA: quando um telefone e visto pela primeira vez, o Cliente e criado com
 * um nome provisorio (o proprio telefone) para satisfazer a FK obrigatoria de
 * `ConversaWhatsapp.clienteId`; o nome real informado pelo cliente durante o
 * fluxo guiado fica registrado apenas em `contextoDados.nomeCliente` (usado
 * nas saudacoes), sem atualizar `Cliente.nome`. Ja o e-mail opcional
 * coletado no passo `aguardando_email` e persistido em `Cliente.email` via
 * `ClienteRepository.update` assim que a OS e criada.
 */
export class ProcessarMensagemWhatsappUseCase {
  constructor(private readonly deps: ProcessarMensagemWhatsappDeps) {}

  async execute(input: ProcessarMensagemWhatsappInput): Promise<ProcessarMensagemWhatsappResultado> {
    const { conversaWhatsappRepository, clienteRepository, categoriaServicoRepository, criarOrdemServicoUseCase } =
      this.deps;
    const { telefone, mensagemRecebida } = input;

    let cliente = await clienteRepository.findByTelefone(telefone);
    const clienteJaExistia = cliente !== null;

    if (!cliente) {
      cliente = await clienteRepository.create({
        nome: telefone,
        telefoneWhatsapp: telefone,
      });
    }

    let conversa = await conversaWhatsappRepository.findByTelefone(telefone);

    if (!conversa || conversa.estadoFluxo === 'os_criada') {
      conversa = await conversaWhatsappRepository.create({
        clienteId: cliente.id,
        telefoneWhatsapp: telefone,
        estadoFluxo: 'inicio',
        contextoDados: {},
      });
    }

    // Sem fluxo de abertura em andamento (conversa recem-iniciada ou
    // reiniciada apos os_criada): antes de seguir para a abertura de nova OS,
    // verifica se a mensagem expressa intencao de CONSULTA DE STATUS. Fluxos
    // ja em andamento (aguardando_categoria/aguardando_descricao) nunca
    // passam por aqui, pois so recriamos/mantemos `conversa.estadoFluxo`
    // como 'inicio' nesses dois casos.
    if (conversa.estadoFluxo === 'inicio') {
      const intencaoPagamento = detectarIntencaoPagamento(mensagemRecebida);

      if (intencaoPagamento) {
        const respostasParaEnviar = await this.deps.consultarPagamentoViaWhatsappUseCase.execute({
          clienteId: cliente.id,
          intencao: intencaoPagamento,
        });

        return { conversa, respostasParaEnviar };
      }

      const intencaoConsulta = detectarIntencaoConsulta(mensagemRecebida);

      if (intencaoConsulta) {
        const respostasParaEnviar = await this.deps.consultarStatusOSViaWhatsappUseCase.execute({
          clienteId: cliente.id,
          intencao: intencaoConsulta,
        });

        return { conversa, respostasParaEnviar };
      }

      // Nao e consulta de status, mas parece uma pergunta/duvida geral (ex.:
      // "voces atendem aos sabados?"): tenta responder via FAQ (IA) antes de
      // iniciar o fluxo guiado de abertura de nova OS.
      if (detectarPerguntaGeral(mensagemRecebida)) {
        const respostasParaEnviar = await this.tratarPerguntaGeral(cliente.id, conversa, mensagemRecebida);
        return { conversa, respostasParaEnviar };
      }
    }

    const categorias = await categoriaServicoRepository.list(false);
    const categoriasDisponiveis = categorias.map((categoria) => ({ id: categoria.id, nome: categoria.nome }));

    const contextoAtual: ContextoConversaWhatsapp = {
      ...conversa.contextoDados,
      clienteConhecido: clienteJaExistia,
    };

    const resultadoFluxo = processarFluxoConversa(
      conversa.estadoFluxo,
      contextoAtual,
      mensagemRecebida,
      categoriasDisponiveis,
    );

    let novoEstado: EstadoFluxoConversa = resultadoFluxo.novoEstado;
    let novoContexto = resultadoFluxo.novoContexto;
    let respostasParaEnviar = [...resultadoFluxo.respostasParaEnviar];
    let ordemServicoCriada: OrdemServico | undefined;
    let dataAgendada: Date | undefined;

    // O cliente acabou de informar uma data/hora valida em
    // aguardando_data_agendamento (dominio ja "aceitou" tentativamente e
    // avancou para os_criada): antes de confirmar de fato, checa se ha ao
    // menos um tecnico livre nesse horario. Sem isso, nao avanca nem cria a OS.
    const informouDataAgendamentoValida =
      conversa.estadoFluxo === 'aguardando_data_agendamento' &&
      novoEstado === 'os_criada' &&
      typeof novoContexto.dataAgendamentoISO === 'string';

    if (informouDataAgendamentoValida) {
      const dataInformada = new Date(novoContexto.dataAgendamentoISO as string);
      const tecnicosDisponiveis = await this.deps.verificarDisponibilidadeUseCase.listarTecnicosDisponiveis(
        dataInformada,
        ['tecnico'],
        this.deps.usuarioRepository,
      );

      if (tecnicosDisponiveis.length === 0) {
        const contextoSemData: ContextoConversaWhatsapp = { ...novoContexto };
        delete contextoSemData.dataAgendamentoISO;
        novoEstado = 'aguardando_data_agendamento';
        novoContexto = contextoSemData;
        respostasParaEnviar = [
          {
            tipo: 'texto',
            mensagem: 'Esse horario ja esta totalmente ocupado, poderia escolher outro dia/horario?',
          },
        ];
      } else {
        dataAgendada = dataInformada;
      }
    }

    const acabaDeConcluirOS = novoEstado === 'os_criada' && conversa.estadoFluxo !== 'os_criada';

    if (acabaDeConcluirOS) {
      if (!novoContexto.categoriaId || !novoContexto.descricaoProblema) {
        throw new Error(
          'Fluxo de conversa chegou em os_criada sem categoriaId/descricaoProblema no contexto (estado inconsistente)',
        );
      }

      ordemServicoCriada = await criarOrdemServicoUseCase.execute({
        clienteId: cliente.id,
        categoriaServicoId: novoContexto.categoriaId,
        descricaoProblema: novoContexto.descricaoProblema,
        criadoVia: 'whatsapp',
        dataAgendada,
      });

      if (novoContexto.emailCliente) {
        await clienteRepository.update(cliente.id, { email: novoContexto.emailCliente });
      }

      novoContexto = { ...novoContexto, numeroOrdemServico: ordemServicoCriada.numero };
      respostasParaEnviar.push({
        tipo: 'texto',
        mensagem: `Sua Ordem de Servico foi registrada com sucesso! Numero: ${ordemServicoCriada.numero}. Em breve nossa equipe entrara em contato.`,
      });
    }

    const conversaAtualizada = await conversaWhatsappRepository.update(conversa.id, {
      estadoFluxo: novoEstado,
      contextoDados: novoContexto,
      ordemServicoId: ordemServicoCriada?.id,
    });

    return {
      conversa: conversaAtualizada,
      respostasParaEnviar,
      ordemServicoCriada,
    };
  }

  /**
   * Trata uma mensagem identificada como pergunta/duvida geral: tenta
   * responder via FAQ (IA); se a FAQ nao souber responder, escalona criando
   * uma `SolicitacaoAtendimento` pendente. Nao altera o estado da conversa em
   * nenhum dos dois casos.
   */
  private async tratarPerguntaGeral(
    clienteId: string,
    conversa: ConversaWhatsapp,
    pergunta: string,
  ): Promise<ComandoResposta[]> {
    const resultado = await this.deps.buscarRespostaFaqUseCase.execute(pergunta);

    if (resultado.respondeu) {
      return [{ tipo: 'texto', mensagem: resultado.resposta }];
    }

    await this.deps.criarSolicitacaoAtendimentoUseCase.execute({
      clienteId,
      conversaId: conversa.id,
      mensagemCliente: pergunta,
    });

    return [
      {
        tipo: 'texto',
        mensagem:
          'Nao consegui responder sua pergunta agora, mas ja encaminhei para um de nossos atendentes, que vai te responder em breve!',
      },
    ];
  }
}
