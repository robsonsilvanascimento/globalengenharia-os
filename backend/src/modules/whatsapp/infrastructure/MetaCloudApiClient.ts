/**
 * Cliente para a Meta WhatsApp Cloud API (Graph API).
 * Usa o `fetch` nativo do Node 20 (injetavel via `fetchFn` para facilitar testes).
 */
import { logger } from '../../../shared/infra/Logger';

export type ResultadoEnvio =
  | { sucesso: true; messageId: string }
  | { sucesso: false; erro: string; codigoErro?: string };

export interface CategoriaMenu {
  id: string;
  nome: string;
}

type FetchFn = typeof globalThis.fetch;

const GRAPH_API_VERSION = 'v19.0';

// Sem timeout, uma Meta Cloud API lenta/travada prende o worker BullMQ
// indefinidamente numa unica mensagem, atrasando toda a fila de envio.
const TIMEOUT_MS = 15_000;

function montarUrlEnvio(): string {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

function montarUrlMedia(): string {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`;
}

function montarHeadersMedia(): Record<string, string> {
  const token = process.env.META_WHATSAPP_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
  };
}

function montarHeaders(): Record<string, string> {
  const token = process.env.META_WHATSAPP_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

interface MetaErrorResponseBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
}

interface MetaSuccessResponseBody {
  messages?: Array<{ id: string }>;
}

interface MetaMediaUploadSuccessBody {
  id?: string;
}

export type ResultadoUploadMedia =
  | { sucesso: true; mediaId: string }
  | { sucesso: false; erro: string };

async function executarEnvio(
  payload: Record<string, unknown>,
  fetchFn: FetchFn,
): Promise<ResultadoEnvio> {
  try {
    const response = await fetchFn(montarUrlEnvio(), {
      method: 'POST',
      headers: montarHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as
      | MetaSuccessResponseBody
      | MetaErrorResponseBody;

    if (!response.ok) {
      const errorBody = body as MetaErrorResponseBody;
      const mensagemErro = errorBody.error?.message ?? `Erro HTTP ${response.status} na Meta Cloud API`;
      const codigoErro = errorBody.error?.code !== undefined ? String(errorBody.error.code) : undefined;

      logger.error(
        { status: response.status, erro: errorBody.error },
        'Falha ao enviar mensagem via Meta WhatsApp Cloud API',
      );

      return { sucesso: false, erro: mensagemErro, codigoErro };
    }

    const successBody = body as MetaSuccessResponseBody;
    const messageId = successBody.messages?.[0]?.id;

    if (!messageId) {
      logger.error({ body: successBody }, 'Resposta da Meta Cloud API sem messageId');
      return { sucesso: false, erro: 'Resposta da Meta Cloud API sem messageId' };
    }

    return { sucesso: true, messageId };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro desconhecido ao chamar Meta Cloud API';
    logger.error({ err }, 'Erro de rede ao enviar mensagem via Meta WhatsApp Cloud API');
    return { sucesso: false, erro: mensagemErro };
  }
}

/** Envia uma mensagem de texto simples via WhatsApp Cloud API. */
export async function enviarTexto(
  telefoneDestino: string,
  mensagem: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  return executarEnvio(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefoneDestino,
      type: 'text',
      text: { body: mensagem },
    },
    fetchFn,
  );
}

/** Envia uma interactive list message com categorias de servico como opcoes. */
export async function enviarMenuCategorias(
  telefoneDestino: string,
  categorias: CategoriaMenu[],
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  return executarEnvio(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefoneDestino,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Selecione uma categoria de servico:' },
        action: {
          button: 'Ver categorias',
          sections: [
            {
              title: 'Categorias disponiveis',
              rows: categorias.map((categoria) => ({
                id: categoria.id,
                title: categoria.nome,
              })),
            },
          ],
        },
      },
    },
    fetchFn,
  );
}

/** Envia uma mensagem de template aprovado, com parametros no corpo. */
export async function enviarTemplate(
  telefoneDestino: string,
  nomeTemplate: string,
  parametros: string[],
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  return executarEnvio(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefoneDestino,
      type: 'template',
      template: {
        name: nomeTemplate,
        language: { code: 'pt_BR' },
        components:
          parametros.length > 0
            ? [
                {
                  type: 'body',
                  parameters: parametros.map((parametro) => ({
                    type: 'text',
                    text: parametro,
                  })),
                },
              ]
            : [],
      },
    },
    fetchFn,
  );
}

/** Faz upload de um arquivo de midia para a Meta Cloud API, retornando o mediaId. */
export async function uploadMedia(
  conteudo: Buffer,
  filename: string,
  mimeType: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoUploadMedia> {
  try {
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([conteudo], { type: mimeType }), filename);
    formData.append('type', mimeType);

    const response = await fetchFn(montarUrlMedia(), {
      method: 'POST',
      headers: montarHeadersMedia(),
      body: formData,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as
      | MetaMediaUploadSuccessBody
      | MetaErrorResponseBody;

    if (!response.ok) {
      const errorBody = body as MetaErrorResponseBody;
      const mensagemErro = errorBody.error?.message ?? `Erro HTTP ${response.status} na Meta Cloud API`;

      logger.error(
        { status: response.status, erro: errorBody.error },
        'Falha ao fazer upload de midia via Meta WhatsApp Cloud API',
      );

      return { sucesso: false, erro: mensagemErro };
    }

    const successBody = body as MetaMediaUploadSuccessBody;
    const mediaId = successBody.id;

    if (!mediaId) {
      logger.error({ body: successBody }, 'Resposta da Meta Cloud API sem mediaId');
      return { sucesso: false, erro: 'Resposta da Meta Cloud API sem mediaId' };
    }

    return { sucesso: true, mediaId };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro desconhecido ao chamar Meta Cloud API';
    logger.error({ err }, 'Erro de rede ao fazer upload de midia via Meta WhatsApp Cloud API');
    return { sucesso: false, erro: mensagemErro };
  }
}

/** Envia um documento (ex.: PDF) via WhatsApp Cloud API, fazendo o upload previo da midia. */
export async function enviarDocumento(
  telefoneDestino: string,
  conteudo: Buffer,
  filename: string,
  mimeType: string,
  caption?: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  const resultadoUpload = await uploadMedia(conteudo, filename, mimeType, fetchFn);

  if (!resultadoUpload.sucesso) {
    return { sucesso: false, erro: resultadoUpload.erro };
  }

  return executarEnvio(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefoneDestino,
      type: 'document',
      document: {
        id: resultadoUpload.mediaId,
        filename,
        ...(caption ? { caption } : {}),
      },
    },
    fetchFn,
  );
}

/** Envia um audio via WhatsApp Cloud API, fazendo o upload previo da midia. */
export async function enviarAudio(
  telefoneDestino: string,
  conteudo: Buffer,
  mimeType: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  const resultadoUpload = await uploadMedia(conteudo, 'audio', mimeType, fetchFn);

  if (!resultadoUpload.sucesso) {
    return { sucesso: false, erro: resultadoUpload.erro };
  }

  return executarEnvio(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefoneDestino,
      type: 'audio',
      audio: {
        id: resultadoUpload.mediaId,
      },
    },
    fetchFn,
  );
}

interface MetaStatusResponseBody {
  success?: boolean;
}

/**
 * Marca uma mensagem recebida como lida e exibe o indicador de "digitando..." no WhatsApp do cliente.
 * A resposta da Meta para este recurso e `{ success: true }`, sem messageId, entao o messageId
 * de entrada e reaproveitado no retorno de sucesso para manter a forma de `ResultadoEnvio`.
 */
export async function marcarComoLidoEDigitando(
  messageId: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoEnvio> {
  try {
    const response = await fetchFn(montarUrlEnvio(), {
      method: 'POST',
      headers: montarHeaders(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as MetaStatusResponseBody | MetaErrorResponseBody;

    if (!response.ok) {
      const errorBody = body as MetaErrorResponseBody;
      const mensagemErro = errorBody.error?.message ?? `Erro HTTP ${response.status} na Meta Cloud API`;
      const codigoErro = errorBody.error?.code !== undefined ? String(errorBody.error.code) : undefined;

      logger.error(
        { status: response.status, erro: errorBody.error },
        'Falha ao marcar mensagem como lida via Meta WhatsApp Cloud API',
      );

      return { sucesso: false, erro: mensagemErro, codigoErro };
    }

    return { sucesso: true, messageId };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro desconhecido ao chamar Meta Cloud API';
    logger.error({ err }, 'Erro de rede ao marcar mensagem como lida via Meta WhatsApp Cloud API');
    return { sucesso: false, erro: mensagemErro };
  }
}

export type ResultadoDownloadMedia =
  | { sucesso: true; conteudo: Buffer; mimeType: string }
  | { sucesso: false; erro: string };

interface MetaMediaInfoResponseBody {
  url?: string;
  mime_type?: string;
}

/**
 * Baixa uma midia recebida via webhook. A Meta Cloud API exige 2 passos:
 * 1) buscar a URL temporaria e o mime_type do recurso de midia;
 * 2) baixar o binario nessa URL, ambos autenticados com o mesmo Bearer token.
 */
export async function baixarMedia(
  mediaId: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<ResultadoDownloadMedia> {
  try {
    const infoResponse = await fetchFn(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
      method: 'GET',
      headers: montarHeadersMedia(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const infoBody = (await infoResponse.json().catch(() => ({}))) as
      | MetaMediaInfoResponseBody
      | MetaErrorResponseBody;

    if (!infoResponse.ok) {
      const errorBody = infoBody as MetaErrorResponseBody;
      const mensagemErro = errorBody.error?.message ?? `Erro HTTP ${infoResponse.status} na Meta Cloud API`;

      logger.error(
        { status: infoResponse.status, erro: errorBody.error },
        'Falha ao buscar informacoes de midia via Meta WhatsApp Cloud API',
      );

      return { sucesso: false, erro: mensagemErro };
    }

    const successInfoBody = infoBody as MetaMediaInfoResponseBody;
    const { url, mime_type: mimeType } = successInfoBody;

    if (!url || !mimeType) {
      logger.error({ body: successInfoBody }, 'Resposta da Meta Cloud API sem url ou mime_type de midia');
      return { sucesso: false, erro: 'Resposta da Meta Cloud API sem url ou mime_type de midia' };
    }

    const downloadResponse = await fetchFn(url, {
      method: 'GET',
      headers: montarHeadersMedia(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!downloadResponse.ok) {
      logger.error(
        { status: downloadResponse.status },
        'Falha ao baixar binario de midia via Meta WhatsApp Cloud API',
      );

      return { sucesso: false, erro: `Erro HTTP ${downloadResponse.status} ao baixar midia` };
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const conteudo = Buffer.from(arrayBuffer);

    return { sucesso: true, conteudo, mimeType };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro desconhecido ao chamar Meta Cloud API';
    logger.error({ err }, 'Erro de rede ao baixar midia via Meta WhatsApp Cloud API');
    return { sucesso: false, erro: mensagemErro };
  }
}
