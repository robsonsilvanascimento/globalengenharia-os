/**
 * Maquina de estados pura do fluxo guiado de atendimento via WhatsApp.
 * Nao faz nenhum tipo de I/O (sem Prisma, sem chamadas HTTP): recebe o
 * estado atual, o contexto acumulado da conversa, a mensagem recebida do
 * cliente e a lista de categorias disponiveis, e devolve o proximo estado,
 * o novo contexto e os comandos de resposta que a infraestrutura devera
 * executar (enviar texto simples ou o menu de categorias).
 */

/** Estados possiveis do fluxo guiado de atendimento. */
export type EstadoFluxoConversa =
  | 'inicio'
  | 'aguardando_nome_cliente'
  | 'aguardando_categoria'
  | 'aguardando_descricao'
  | 'aguardando_email'
  | 'aguardando_data_agendamento'
  | 'os_criada';

/** Categoria de servico disponivel para exibir no menu (subconjunto de CategoriaServico). */
export interface CategoriaDisponivel {
  id: string;
  nome: string;
}

/**
 * Dados acumulados ao longo da conversa. Persistido como `contextoDados`
 * (Json) na tabela `ConversaWhatsapp`.
 *
 * `clienteConhecido` e calculado pela camada de aplicacao (via
 * `ClienteRepository.findByTelefone`) a cada execucao e informado aqui para
 * que o estado `inicio` decida se pula a pergunta do nome — o dominio em si
 * nao acessa nenhum repositorio.
 */
export interface ContextoConversaWhatsapp {
  clienteConhecido?: boolean;
  nomeCliente?: string;
  categoriaId?: string;
  categoriaNome?: string;
  descricaoProblema?: string;
  emailCliente?: string;
  /**
   * Data/hora de agendamento escolhida pelo cliente (ISO 8601), preenchida em
   * `aguardando_data_agendamento` quando ele informa uma data valida (ausente
   * quando ele recusa/pula essa etapa). A camada de aplicacao e quem decide,
   * apos checar disponibilidade de tecnicos, se essa data e de fato aceita.
   */
  dataAgendamentoISO?: string;
  numeroOrdemServico?: string;
  [chaveExtra: string]: unknown;
}

/** Comando de resposta a ser executado pela infraestrutura (sem I/O no dominio). */
export type ComandoResposta =
  | { tipo: 'texto'; mensagem: string }
  | { tipo: 'menu_categorias'; categorias: CategoriaDisponivel[] };

export interface ResultadoFluxoConversa {
  novoEstado: EstadoFluxoConversa;
  novoContexto: ContextoConversaWhatsapp;
  respostasParaEnviar: ComandoResposta[];
}

function montarComandoMenuCategorias(categorias: CategoriaDisponivel[]): ComandoResposta {
  return { tipo: 'menu_categorias', categorias };
}

function encontrarCategoria(
  mensagem: string,
  categorias: CategoriaDisponivel[],
): CategoriaDisponivel | undefined {
  const porId = categorias.find((categoria) => categoria.id === mensagem);
  if (porId) {
    return porId;
  }

  const mensagemNormalizada = mensagem.toLowerCase();
  return categorias.find((categoria) => categoria.nome.toLowerCase() === mensagemNormalizada);
}

function tratarInicio(
  contexto: ContextoConversaWhatsapp,
  categorias: CategoriaDisponivel[],
): ResultadoFluxoConversa {
  if (contexto.clienteConhecido) {
    const saudacao = contexto.nomeCliente
      ? `Ola novamente, ${contexto.nomeCliente}! Vamos abrir uma nova solicitacao de servico.`
      : 'Ola novamente! Vamos abrir uma nova solicitacao de servico.';

    return {
      novoEstado: 'aguardando_categoria',
      novoContexto: { ...contexto },
      respostasParaEnviar: [
        { tipo: 'texto', mensagem: saudacao },
        montarComandoMenuCategorias(categorias),
      ],
    };
  }

  return {
    novoEstado: 'aguardando_nome_cliente',
    novoContexto: { ...contexto },
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem: 'Ola! Bem-vindo(a) ao nosso atendimento. Para comecar, qual e o seu nome completo?',
      },
    ],
  };
}

function tratarAguardandoNomeCliente(
  contexto: ContextoConversaWhatsapp,
  mensagem: string,
  categorias: CategoriaDisponivel[],
): ResultadoFluxoConversa {
  if (!mensagem) {
    return {
      novoEstado: 'aguardando_nome_cliente',
      novoContexto: { ...contexto },
      respostasParaEnviar: [
        { tipo: 'texto', mensagem: 'Nao entendi. Pode me informar seu nome completo, por favor?' },
      ],
    };
  }

  const novoContexto: ContextoConversaWhatsapp = { ...contexto, nomeCliente: mensagem };

  return {
    novoEstado: 'aguardando_categoria',
    novoContexto,
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem: `Prazer, ${mensagem}! Selecione abaixo a categoria do servico que voce precisa:`,
      },
      montarComandoMenuCategorias(categorias),
    ],
  };
}

function tratarAguardandoCategoria(
  contexto: ContextoConversaWhatsapp,
  mensagem: string,
  categorias: CategoriaDisponivel[],
): ResultadoFluxoConversa {
  const categoriaEscolhida = encontrarCategoria(mensagem, categorias);

  if (!categoriaEscolhida) {
    return {
      novoEstado: 'aguardando_categoria',
      novoContexto: { ...contexto },
      respostasParaEnviar: [
        { tipo: 'texto', mensagem: 'Opcao invalida. Por favor, selecione uma das categorias abaixo:' },
        montarComandoMenuCategorias(categorias),
      ],
    };
  }

  const novoContexto: ContextoConversaWhatsapp = {
    ...contexto,
    categoriaId: categoriaEscolhida.id,
    categoriaNome: categoriaEscolhida.nome,
  };

  return {
    novoEstado: 'aguardando_descricao',
    novoContexto,
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem: `Entendido: ${categoriaEscolhida.nome}. Agora descreva, em poucas palavras, o problema que voce esta enfrentando.`,
      },
    ],
  };
}

function tratarAguardandoDescricao(
  contexto: ContextoConversaWhatsapp,
  mensagem: string,
): ResultadoFluxoConversa {
  if (!mensagem) {
    return {
      novoEstado: 'aguardando_descricao',
      novoContexto: { ...contexto },
      respostasParaEnviar: [
        { tipo: 'texto', mensagem: 'Nao recebi a descricao. Pode descrever o problema, por favor?' },
      ],
    };
  }

  const novoContexto: ContextoConversaWhatsapp = { ...contexto, descricaoProblema: mensagem };

  return {
    novoEstado: 'aguardando_email',
    novoContexto,
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem:
          "Deseja receber uma copia da sua Ordem de Servico em PDF por e-mail? Se sim, informe seu e-mail. Caso nao queira, responda 'nao'.",
      },
    ],
  };
}

const RESPOSTAS_RECUSA_EMAIL = ['nao', 'não', 'n', 'pular'];

/** Validacao simples de formato de e-mail (ex.: "algo@algo.algo"), sem pretensao de RFC completa. */
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ehRecusaEmail(mensagem: string): boolean {
  if (!mensagem) {
    return true;
  }

  return RESPOSTAS_RECUSA_EMAIL.includes(mensagem.toLowerCase());
}

function tratarAguardandoEmail(
  contexto: ContextoConversaWhatsapp,
  mensagem: string,
): ResultadoFluxoConversa {
  const mensagemPerguntaDataAgendamento: ComandoResposta = {
    tipo: 'texto',
    mensagem: 'Qual dia e horario voce prefere para o atendimento? (formato: DD/MM/AAAA HH:MM)',
  };

  if (ehRecusaEmail(mensagem)) {
    return {
      novoEstado: 'aguardando_data_agendamento',
      novoContexto: { ...contexto },
      respostasParaEnviar: [mensagemPerguntaDataAgendamento],
    };
  }

  if (PADRAO_EMAIL.test(mensagem)) {
    return {
      novoEstado: 'aguardando_data_agendamento',
      novoContexto: { ...contexto, emailCliente: mensagem },
      respostasParaEnviar: [mensagemPerguntaDataAgendamento],
    };
  }

  return {
    novoEstado: 'aguardando_email',
    novoContexto: { ...contexto },
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem:
          "Nao entendi. Informe um e-mail valido para receber a copia em PDF, ou responda 'nao' para pular esta etapa.",
      },
    ],
  };
}

/** Recusas reconhecidas para pular a etapa de data/hora de agendamento (comparadas sem acento, case-insensitive). */
const RESPOSTAS_RECUSA_DATA_AGENDAMENTO = ['ainda nao sei', 'nao sei', 'depois'];

/** Formato aceito: DD/MM/AAAA HH:MM (com um ou mais espacos entre data e hora). */
const PADRAO_DATA_AGENDAMENTO = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/;

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function ehRecusaDataAgendamento(mensagem: string): boolean {
  const normalizada = removerAcentos(mensagem.toLowerCase()).trim();
  return RESPOSTAS_RECUSA_DATA_AGENDAMENTO.includes(normalizada);
}

/**
 * Faz o parse de uma data/hora no formato "DD/MM/AAAA HH:MM". Retorna
 * `undefined` quando o formato nao bate com o padrao esperado ou quando os
 * componentes informados nao formam uma data/hora valida (ex.: 31/02, 25:00),
 * evitando o "rollover" silencioso do construtor nativo `Date`.
 */
function parseDataAgendamento(mensagem: string): Date | undefined {
  const match = PADRAO_DATA_AGENDAMENTO.exec(mensagem);
  if (!match) {
    return undefined;
  }

  const [, diaStr, mesStr, anoStr, horaStr, minutoStr] = match;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const ano = Number(anoStr);
  const hora = Number(horaStr);
  const minuto = Number(minutoStr);

  const data = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);

  const componentesValidos =
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia &&
    data.getHours() === hora &&
    data.getMinutes() === minuto;

  return componentesValidos ? data : undefined;
}

function tratarAguardandoDataAgendamento(
  contexto: ContextoConversaWhatsapp,
  mensagem: string,
): ResultadoFluxoConversa {
  const mensagemRegistrandoOS: ComandoResposta = {
    tipo: 'texto',
    mensagem: 'Perfeito! Estamos registrando sua solicitacao de servico...',
  };

  if (ehRecusaDataAgendamento(mensagem)) {
    return {
      novoEstado: 'os_criada',
      novoContexto: { ...contexto },
      respostasParaEnviar: [mensagemRegistrandoOS],
    };
  }

  const dataAgendamento = parseDataAgendamento(mensagem);

  if (dataAgendamento) {
    return {
      novoEstado: 'os_criada',
      novoContexto: { ...contexto, dataAgendamentoISO: dataAgendamento.toISOString() },
      respostasParaEnviar: [mensagemRegistrandoOS],
    };
  }

  return {
    novoEstado: 'aguardando_data_agendamento',
    novoContexto: { ...contexto },
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem:
          "Nao entendi a data informada. Por favor, informe o dia e horario no formato DD/MM/AAAA HH:MM, ou responda 'ainda nao sei' para definir depois.",
      },
    ],
  };
}

function tratarOsCriada(contexto: ContextoConversaWhatsapp): ResultadoFluxoConversa {
  const referencia = contexto.numeroOrdemServico ? ` (Ordem de Servico ${contexto.numeroOrdemServico})` : '';

  return {
    novoEstado: 'os_criada',
    novoContexto: { ...contexto },
    respostasParaEnviar: [
      {
        tipo: 'texto',
        mensagem: `Sua solicitacao ja foi registrada${referencia}. Nossa equipe entrara em contato em breve.`,
      },
    ],
  };
}

/**
 * Calcula a transicao do fluxo guiado de atendimento a partir do estado
 * atual, do contexto acumulado e da mensagem recebida do cliente. Entradas
 * invalidas (ex.: opcao de categoria fora do menu, nome/descricao vazios)
 * mantem o estado atual e reenviam a pergunta, sem quebrar o fluxo.
 */
export function processarFluxoConversa(
  estadoAtual: EstadoFluxoConversa,
  contextoDados: ContextoConversaWhatsapp,
  mensagemRecebida: string,
  categoriasDisponiveis: CategoriaDisponivel[],
): ResultadoFluxoConversa {
  const mensagem = mensagemRecebida.trim();

  switch (estadoAtual) {
    case 'inicio':
      return tratarInicio(contextoDados, categoriasDisponiveis);
    case 'aguardando_nome_cliente':
      return tratarAguardandoNomeCliente(contextoDados, mensagem, categoriasDisponiveis);
    case 'aguardando_categoria':
      return tratarAguardandoCategoria(contextoDados, mensagem, categoriasDisponiveis);
    case 'aguardando_descricao':
      return tratarAguardandoDescricao(contextoDados, mensagem);
    case 'aguardando_email':
      return tratarAguardandoEmail(contextoDados, mensagem);
    case 'aguardando_data_agendamento':
      return tratarAguardandoDataAgendamento(contextoDados, mensagem);
    case 'os_criada':
      return tratarOsCriada(contextoDados);
    default:
      // Estado desconhecido/corrompido: reinicia o fluxo de forma segura.
      return tratarInicio(contextoDados, categoriasDisponiveis);
  }
}
