import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { QUEUE_NAMES, type WhatsappConversaJobData } from '../../../../shared/infra/queues';
import {
  enviarMenuCategorias,
  enviarTexto,
  enviarAudio,
  marcarComoLidoEDigitando,
  baixarMedia,
  type ResultadoEnvio,
} from '../MetaCloudApiClient';
import { transcreverAudio } from '../../../../shared/infra/audio/TranscreverAudioService';
import { gerarAudio } from '../../../../shared/infra/audio/GerarAudioService';
import type { MensagemWhatsappRepository } from '../../domain/MensagemWhatsappRepository';
import type { ConversaWhatsappRepository } from '../../domain/ConversaWhatsappRepository';
import type { ProcessarMensagemWhatsappUseCase } from '../../application/ProcessarMensagemWhatsappUseCase';
import type { ComandoResposta } from '../../domain/FluxoConversa';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { CriarMidiaOrdemServicoUseCase } from '../../../midias/application/CriarMidiaOrdemServicoUseCase';

export interface WhatsappConversaWorkerDeps {
  processarMensagemWhatsappUseCase: ProcessarMensagemWhatsappUseCase;
  mensagemWhatsappRepository: MensagemWhatsappRepository;
  conversaWhatsappRepository: ConversaWhatsappRepository;
  clienteRepository: ClienteRepository;
  criarMidiaOrdemServicoUseCase: CriarMidiaOrdemServicoUseCase;
}

interface EnvioComando {
  resultado: ResultadoEnvio;
  tipoConteudo: string;
  conteudo: string;
}

const MENSAGEM_ERRO_TRANSCRICAO_AUDIO =
  'Nao consegui entender seu audio, pode tentar novamente ou escrever sua mensagem?';

const MENSAGEM_ERRO_DOWNLOAD_VIDEO =
  'Nao consegui processar seu video, pode tentar enviar novamente?';

/**
 * Executa um comando de texto: se a mensagem recebida era um audio, tenta
 * responder tambem em audio (TTS via `gerarAudio` + `enviarAudio`); se a
 * geracao do audio falhar (ex.: erro da API da OpenAI), cai de volta para
 * texto simples, para nunca deixar o cliente sem resposta.
 */
async function executarComandoTexto(
  telefone: string,
  mensagem: string,
  respostaEmAudio: boolean,
): Promise<EnvioComando> {
  if (respostaEmAudio) {
    const audio = await gerarAudio(mensagem);

    if (audio.sucesso) {
      const resultado = await enviarAudio(telefone, audio.conteudo, audio.mimeType);
      return { resultado, tipoConteudo: 'audio', conteudo: mensagem };
    }

    logger.warn(
      { erro: audio.erro, telefone },
      'Falha ao gerar audio de resposta via TTS - enviando resposta em texto',
    );
  }

  const resultado = await enviarTexto(telefone, mensagem);
  return { resultado, tipoConteudo: 'text', conteudo: mensagem };
}

/**
 * Executa um ComandoResposta via Meta Cloud API, devolvendo o resultado do
 * envio e o payload a persistir. Menus de categorias sao sempre enviados
 * como interactive list message, mesmo quando a pergunta recebida era audio
 * (nao da para "falar" um menu de botoes).
 */
async function executarComando(
  telefone: string,
  comando: ComandoResposta,
  respostaEmAudio: boolean,
): Promise<EnvioComando> {
  if (comando.tipo === 'texto') {
    return executarComandoTexto(telefone, comando.mensagem, respostaEmAudio);
  }

  const resultado = await enviarMenuCategorias(telefone, comando.categorias);
  return { resultado, tipoConteudo: 'interactive', conteudo: JSON.stringify(comando.categorias) };
}

/** Resultado da etapa de resolucao da mensagem de entrada (texto pronto para o fluxo, ou falha de audio). */
type ResolucaoMensagem =
  | { ok: true; mensagem: string }
  | { ok: false };

/**
 * Resolve o texto efetivo da mensagem recebida: mensagens de texto sao usadas
 * como estao; mensagens de audio sao baixadas (`baixarMedia`, usando o media
 * id capturado pelo webhook em `conteudo`) e transcritas (`transcreverAudio`)
 * antes de seguir para o restante do fluxo, que trabalha apenas com texto.
 */
async function resolverMensagemRecebida(
  tipo: string | undefined,
  conteudo: string,
  waMessageId: string,
): Promise<ResolucaoMensagem> {
  if (tipo !== 'audio') {
    return { ok: true, mensagem: conteudo };
  }

  const download = await baixarMedia(conteudo);

  if (!download.sucesso) {
    logger.warn(
      { erro: download.erro, waMessageId },
      'Falha ao baixar audio recebido via WhatsApp',
    );
    return { ok: false };
  }

  const transcricao = await transcreverAudio(download.conteudo, download.mimeType);

  if (!transcricao.sucesso) {
    logger.warn(
      { erro: transcricao.erro, waMessageId },
      'Falha ao transcrever audio recebido via WhatsApp',
    );
    return { ok: false };
  }

  return { ok: true, mensagem: transcricao.texto };
}

/**
 * Processa uma mensagem de video recebida: baixa o binario (media id
 * capturado pelo webhook em `conteudo`) e, em caso de sucesso, cria o
 * registro de midia (`CriarMidiaOrdemServicoUseCase`) associado ao cliente e,
 * quando ja existir, a Ordem de Servico vinculada a conversa. Video NUNCA e
 * encaminhado ao fluxo guiado (`ProcessarMensagemWhatsappUseCase`): apenas
 * gera o registro de midia + uma mensagem de confirmacao, sem alterar o
 * estado da conversa em andamento (ex.: `aguardando_descricao` permanece
 * intacto apos o recebimento do video).
 */
async function processarVideoRecebido(
  telefoneCliente: string,
  waMessageId: string,
  mediaId: string,
  deps: WhatsappConversaWorkerDeps,
): Promise<void> {
  const download = await baixarMedia(mediaId);

  if (!download.sucesso) {
    logger.warn(
      { erro: download.erro, waMessageId },
      'Falha ao baixar video recebido via WhatsApp',
    );

    const resultadoErro = await enviarTexto(telefoneCliente, MENSAGEM_ERRO_DOWNLOAD_VIDEO);

    if (!resultadoErro.sucesso) {
      logger.error(
        { erro: resultadoErro.erro, codigoErro: resultadoErro.codigoErro, telefoneCliente },
        'Falha ao enviar mensagem de erro de download de video',
      );
    }

    return;
  }

  let cliente = await deps.clienteRepository.findByTelefone(telefoneCliente);

  if (!cliente) {
    cliente = await deps.clienteRepository.create({
      nome: telefoneCliente,
      telefoneWhatsapp: telefoneCliente,
    });
  }

  const conversa = await deps.conversaWhatsappRepository.findByTelefone(telefoneCliente);
  const ordemServicoId = conversa?.ordemServicoId;
  const numeroOrdemServico = conversa?.contextoDados.numeroOrdemServico;

  await deps.criarMidiaOrdemServicoUseCase.execute({
    clienteId: cliente.id,
    ordemServicoId,
    tipo: 'video',
    buffer: download.conteudo,
    nomeArquivo: `video-whatsapp-${waMessageId}`,
    mimeType: download.mimeType,
    whatsappMediaId: mediaId,
  });

  const mensagemConfirmacao = ordemServicoId
    ? `Recebemos seu video, ele foi anexado a sua Ordem de Servico ${numeroOrdemServico}!`
    : 'Recebemos seu video, obrigado! Ele ficara registrado para nossa equipe.';

  const resultadoConfirmacao = await enviarTexto(telefoneCliente, mensagemConfirmacao);

  if (!resultadoConfirmacao.sucesso) {
    logger.error(
      { erro: resultadoConfirmacao.erro, codigoErro: resultadoConfirmacao.codigoErro, telefoneCliente },
      'Falha ao enviar confirmacao de recebimento de video',
    );
  }
}

/**
 * Processa um job da fila `whatsapp-conversa`: marca a mensagem como lida e
 * exibe o indicador de "digitando" (feedback visual, best-effort). Mensagens
 * de video sao desviadas para `processarVideoRecebido` (registro de midia +
 * confirmacao, sem tocar no estado da conversa). Para as demais, resolve o
 * conteudo textual da mensagem (transcrevendo audio quando aplicavel), roda o
 * fluxo guiado (`ProcessarMensagemWhatsappUseCase`), envia de fato as
 * respostas calculadas via Meta Cloud API (em audio quando a pergunta veio em
 * audio) e persiste as mensagens de entrada/saida.
 */
export async function processarJob(
  job: Job<WhatsappConversaJobData>,
  deps: WhatsappConversaWorkerDeps,
): Promise<void> {
  const { telefoneCliente, waMessageId, tipo, conteudo } = job.data;

  try {
    const statusLeitura = await marcarComoLidoEDigitando(waMessageId);

    if (!statusLeitura.sucesso) {
      logger.warn(
        { erro: statusLeitura.erro, waMessageId },
        'Falha ao marcar mensagem como lida / exibir indicador de "digitando" (nao bloqueia o processamento)',
      );
    }
  } catch (err) {
    logger.warn(
      { err, waMessageId },
      'Erro inesperado ao marcar mensagem como lida / exibir indicador de "digitando" (nao bloqueia o processamento)',
    );
  }

  if (tipo === 'video') {
    await processarVideoRecebido(telefoneCliente, waMessageId, conteudo ?? '', deps);
    return;
  }

  const mensagemEraAudio = tipo === 'audio';
  const resolucao = await resolverMensagemRecebida(tipo, conteudo ?? '', waMessageId);

  if (!resolucao.ok) {
    const resultadoEnvio = await enviarTexto(telefoneCliente, MENSAGEM_ERRO_TRANSCRICAO_AUDIO);

    if (!resultadoEnvio.sucesso) {
      logger.error(
        { erro: resultadoEnvio.erro, codigoErro: resultadoEnvio.codigoErro, telefoneCliente },
        'Falha ao enviar mensagem de erro de transcricao de audio',
      );
    }

    return;
  }

  const mensagemRecebida = resolucao.mensagem;

  const resultado = await deps.processarMensagemWhatsappUseCase.execute({
    telefone: telefoneCliente,
    mensagemRecebida,
  });

  try {
    await deps.mensagemWhatsappRepository.create({
      conversaId: resultado.conversa.id,
      direcao: 'entrada',
      tipoConteudo: tipo ?? 'text',
      conteudo: mensagemRecebida,
      whatsappMessageId: waMessageId,
    });
  } catch (err) {
    // Provavel duplicidade (whatsappMessageId unico) em um retry do BullMQ do
    // mesmo job: nao interrompe o processamento das respostas.
    logger.warn(
      { err, waMessageId },
      'Falha ao persistir mensagem de entrada do WhatsApp (possivel duplicidade em retry) - prosseguindo',
    );
  }

  for (const comando of resultado.respostasParaEnviar) {
    const envio = await executarComando(telefoneCliente, comando, mensagemEraAudio);

    if (!envio.resultado.sucesso) {
      logger.error(
        { erro: envio.resultado.erro, codigoErro: envio.resultado.codigoErro, telefoneCliente },
        'Falha ao enviar resposta do fluxo de conversa via WhatsApp',
      );
      continue;
    }

    await deps.mensagemWhatsappRepository.create({
      conversaId: resultado.conversa.id,
      direcao: 'saida',
      tipoConteudo: envio.tipoConteudo,
      conteudo: envio.conteudo,
      whatsappMessageId: envio.resultado.messageId,
    });
  }
}

/**
 * Cria o Worker (BullMQ) consumidor da fila `whatsapp-conversa`, com
 * concorrencia 1 — a fila ja e particionada por telefone via jobId
 * deterministico (`buildConversaJobId`), entao 1 worker sequencial e
 * suficiente e evita qualquer condicao de corrida no calculo do proximo
 * estado da mesma conversa.
 *
 * Erros lancados pelo processor NAO derrubam o processo Node: o BullMQ
 * apenas marca o job como falho e aplica o retry configurado em
 * `defaultJobOptions` (3 tentativas, backoff exponencial). Preferimos deixar
 * o retry automatico cuidar de falhas transitorias (rede, banco) a engolir
 * o erro aqui, exceto no caso especifico de duplicidade da mensagem de
 * entrada (tratado acima).
 */
export function createWhatsappConversaWorker(deps: WhatsappConversaWorkerDeps): Worker<WhatsappConversaJobData> {
  const worker = new Worker<WhatsappConversaJobData>(
    QUEUE_NAMES.WHATSAPP_CONVERSA,
    (job) => processarJob(job, deps),
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila whatsapp-conversa falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila whatsapp-conversa');
  });

  return worker;
}
