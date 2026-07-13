import OpenAI from 'openai';
import { logger } from '../Logger';

/** Resultado da geracao de audio (texto-para-voz) via OpenAI. */
export type ResultadoGeracaoAudio =
  | { sucesso: true; conteudo: Buffer; mimeType: string }
  | { sucesso: false; erro: string };

const MODELO_DEFAULT = 'tts-1';
const VOZ_DEFAULT = 'alloy';

/**
 * Formato de saida escolhido: `opus` (container OGG), pois e o formato nativo
 * das mensagens de voz do WhatsApp (audio/ogg; codecs=opus), evitando
 * conversao adicional antes do envio pelo bot.
 */
const FORMATO_SAIDA = 'opus';
const MIME_TYPE_SAIDA = 'audio/ogg';

let clientSingleton: OpenAI | undefined;

function obterClient(): OpenAI {
  if (!clientSingleton) {
    clientSingleton = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return clientSingleton;
}

function extrairMensagemErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }
  return String(erro);
}

/**
 * Converte um texto em audio falado usando o endpoint de text-to-speech da
 * OpenAI, para uso pelo bot do WhatsApp. Nunca lanca excecao: qualquer falha
 * (texto vazio, rede, chave invalida, rate limit) e capturada e retornada
 * como `{ sucesso: false, erro }`.
 */
export async function gerarAudio(
  texto: string,
  openaiClient: OpenAI = obterClient(),
): Promise<ResultadoGeracaoAudio> {
  try {
    if (!texto || !texto.trim()) {
      return { sucesso: false, erro: 'Texto vazio: nao ha o que converter em audio' };
    }

    const modelo = process.env.OPENAI_TTS_MODEL ?? MODELO_DEFAULT;
    const voz = process.env.OPENAI_TTS_VOICE ?? VOZ_DEFAULT;

    const resposta = await openaiClient.audio.speech.create({
      model: modelo,
      voice: voz,
      input: texto,
      response_format: FORMATO_SAIDA,
    });

    const arrayBuffer = await resposta.arrayBuffer();
    const conteudo = Buffer.from(arrayBuffer);

    return { sucesso: true, conteudo, mimeType: MIME_TYPE_SAIDA };
  } catch (erro) {
    const mensagem = extrairMensagemErro(erro);
    logger.error({ err: erro }, 'Falha ao gerar audio via OpenAI TTS');
    return { sucesso: false, erro: mensagem };
  }
}
