import OpenAI, { toFile } from 'openai';
import { logger } from '../Logger';

/** Resultado da transcricao de um audio recebido via WhatsApp. */
export type ResultadoTranscricao = { sucesso: true; texto: string } | { sucesso: false; erro: string };

const MODELO_DEFAULT = 'whisper-1';

/** Mapa dos mimeTypes de audio mais comuns enviados pela Meta Cloud API para a extensao de arquivo equivalente. */
const EXTENSAO_POR_MIME_TYPE: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

const EXTENSAO_DEFAULT = 'ogg';

function extensaoParaMimeType(mimeType: string): string {
  const mimeTypeNormalizado = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return EXTENSAO_POR_MIME_TYPE[mimeTypeNormalizado] ?? EXTENSAO_DEFAULT;
}

let clientSingleton: OpenAI | undefined;

function obterClientPadrao(): OpenAI {
  if (!clientSingleton) {
    clientSingleton = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return clientSingleton;
}

/**
 * Transcreve um audio (voice note recebido via WhatsApp) usando a API de
 * transcricao de audio da OpenAI (Whisper). Nunca lanca excecao: qualquer
 * falha (rede, chave invalida, formato nao suportado, rate limit) e tratada
 * e retornada como `{ sucesso: false, erro }`, para que quem chama sempre
 * possa seguir o fluxo (ex: pedir para o cliente digitar a mensagem).
 */
export async function transcreverAudio(
  conteudo: Buffer,
  mimeType: string,
  openaiClient?: OpenAI,
): Promise<ResultadoTranscricao> {
  try {
    const client = openaiClient ?? obterClientPadrao();
    const modelo = process.env.OPENAI_STT_MODEL ?? MODELO_DEFAULT;
    const extensao = extensaoParaMimeType(mimeType);

    const arquivo = await toFile(conteudo, `audio.${extensao}`, { type: mimeType });

    const transcricao = await client.audio.transcriptions.create({
      file: arquivo,
      model: modelo,
    });

    const texto = typeof transcricao?.text === 'string' ? transcricao.text.trim() : '';

    if (!texto) {
      return { sucesso: false, erro: 'Transcricao vazia retornada pela API' };
    }

    return { sucesso: true, texto };
  } catch (error) {
    const erro = error instanceof Error ? error.message : 'Erro desconhecido ao transcrever audio';
    logger.warn({ err: error, mimeType }, 'Falha ao transcrever audio via OpenAI');
    return { sucesso: false, erro };
  }
}
