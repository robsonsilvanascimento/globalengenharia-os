import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { logger } from '../../../../shared/infra/Logger';
import { enfileirarMensagemRecebida, type MensagemRecebidaWebhook } from '../queues/enfileirar-mensagem';

declare module 'fastify' {
  interface FastifyRequest {
    /** Corpo bruto (string) do request, preservado para validacao de assinatura HMAC. */
    rawBody?: string;
  }
}

interface MetaWebhookMessageContent {
  body?: string;
  [key: string]: unknown;
}

interface MetaWebhookMessageAudio {
  id: string;
  mime_type?: string;
  [key: string]: unknown;
}

interface MetaWebhookMessageVideo {
  id: string;
  mime_type?: string;
  [key: string]: unknown;
}

interface MetaWebhookMessage {
  from: string;
  id: string;
  type: string;
  text?: MetaWebhookMessageContent;
  audio?: MetaWebhookMessageAudio;
  video?: MetaWebhookMessageVideo;
  [key: string]: unknown;
}

interface MetaWebhookValue {
  messages?: MetaWebhookMessage[];
  [key: string]: unknown;
}

interface MetaWebhookChange {
  value: MetaWebhookValue;
  field?: string;
}

interface MetaWebhookEntry {
  id?: string;
  changes?: MetaWebhookChange[];
}

interface MetaWebhookBody {
  object?: string;
  entry?: MetaWebhookEntry[];
}

/**
 * Extrai o conteudo textual/relevante de uma mensagem, de acordo com o `type`.
 *
 * Para `audio` e `video`, o conteudo extraido e o `media id`
 * (`mensagem.audio.id`/`mensagem.video.id`), NAO o binario da midia: o
 * download via `MetaCloudApiClient.baixarMedia` acontece de forma assincrona
 * no worker da fila `whatsapp-conversa`, para nao estourar o limite de 20s de
 * resposta que a Meta exige deste webhook.
 */
function extrairConteudo(mensagem: MetaWebhookMessage): string {
  if (mensagem.type === 'text') {
    return mensagem.text?.body ?? '';
  }

  if (mensagem.type === 'audio') {
    return mensagem.audio?.id ?? '';
  }

  if (mensagem.type === 'video') {
    return mensagem.video?.id ?? '';
  }

  const campoDoTipo = mensagem[mensagem.type];

  if (typeof campoDoTipo === 'string') {
    return campoDoTipo;
  }

  if (campoDoTipo !== undefined) {
    return JSON.stringify(campoDoTipo);
  }

  return '';
}

/** Percorre `entry[].changes[].value.messages[]` extraindo as mensagens recebidas. */
function extrairMensagens(body: MetaWebhookBody): MensagemRecebidaWebhook[] {
  const mensagens: MensagemRecebidaWebhook[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const mensagem of change.value?.messages ?? []) {
        mensagens.push({
          telefone: mensagem.from,
          whatsappMessageId: mensagem.id,
          tipo: mensagem.type,
          conteudo: extrairConteudo(mensagem),
        });
      }
    }
  }

  return mensagens;
}

/**
 * Valida a assinatura HMAC SHA256 enviada pela Meta no header
 * `X-Hub-Signature-256`, no formato `sha256=<hex>`, calculada sobre o body bruto.
 */
export function assinaturaWebhookValida(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const [esquema, assinaturaRecebida] = signatureHeader.split('=');

  if (esquema !== 'sha256' || !assinaturaRecebida) {
    return false;
  }

  const assinaturaEsperada = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const bufferRecebido = Buffer.from(assinaturaRecebida, 'hex');
  const bufferEsperado = Buffer.from(assinaturaEsperada, 'hex');

  if (bufferRecebido.length !== bufferEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferRecebido, bufferEsperado);
}

/**
 * Registra as rotas do webhook do WhatsApp (Meta Cloud API) em um contexto
 * encapsulado do Fastify, com um content-type parser proprio que preserva o
 * body bruto (necessario para validar a assinatura HMAC) sem afetar as
 * demais rotas da aplicacao.
 */
export function registerWhatsappWebhookRoutes(app: FastifyInstance): void {
  app.register(async (instance) => {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (request, body, done) => {
        request.rawBody = body as string;

        if (!body) {
          done(null, {});
          return;
        }

        try {
          done(null, JSON.parse(body as string));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

    instance.get('/webhook/whatsapp', async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const mode = query['hub.mode'];
      const verifyToken = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode === 'subscribe' && verifyToken === process.env.META_VERIFY_TOKEN) {
        return reply.status(200).type('text/plain').send(challenge ?? '');
      }

      logger.warn({ mode }, 'Falha na verificacao do webhook do WhatsApp: token invalido');
      return reply.status(403).send('Forbidden');
    });

    instance.post('/webhook/whatsapp', async (request, reply) => {
      const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = request.rawBody ?? '';

      if (!assinaturaWebhookValida(rawBody, signatureHeader, process.env.META_APP_SECRET)) {
        logger.warn('Assinatura HMAC invalida recebida no webhook do WhatsApp');
        return reply.status(401).send({ message: 'Assinatura invalida' });
      }

      const body = request.body as MetaWebhookBody;
      const mensagens = extrairMensagens(body);

      // Enfileira e responde imediatamente: a Meta exige resposta em menos de
      // 20s, entao o processamento efetivo do fluxo de conversa acontece de
      // forma assincrona no worker da fila `whatsapp-conversa`.
      await Promise.all(
        mensagens.map((mensagem) =>
          enfileirarMensagemRecebida(mensagem).catch((err) => {
            logger.error(
              { err, whatsappMessageId: mensagem.whatsappMessageId },
              'Falha ao enfileirar mensagem recebida do WhatsApp',
            );
          }),
        ),
      );

      return reply.status(200).type('text/plain').send('EVENT_RECEIVED');
    });
  });
}
