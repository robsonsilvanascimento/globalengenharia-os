import crypto from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const APP_SECRET = 'app-secret-de-teste';
const VERIFY_TOKEN = 'verify-token-de-teste';

const { findUniqueMock, enqueueWhatsappConversaJobMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  enqueueWhatsappConversaJobMock: vi.fn(),
}));

vi.mock('../../../../shared/infra/PrismaClient', () => ({
  prisma: {
    mensagemWhatsapp: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('../../../../shared/infra/queues', () => ({
  enqueueWhatsappConversaJob: enqueueWhatsappConversaJobMock,
}));

import { registerWhatsappWebhookRoutes, assinaturaWebhookValida } from './webhook-routes';

function assinar(rawBody: string, secret = APP_SECRET): string {
  const hmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

function buildMensagemPayload(whatsappMessageId: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  from: '5511999999999',
                  id: whatsappMessageId,
                  type: 'text',
                  text: { body: 'Ola, preciso de um encanador' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('webhook-routes (WhatsApp)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.META_VERIFY_TOKEN = VERIFY_TOKEN;

    findUniqueMock.mockReset();
    enqueueWhatsappConversaJobMock.mockReset();

    app = Fastify();
    registerWhatsappWebhookRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /webhook/whatsapp (handshake de verificacao)', () => {
    it('responde 200 com o challenge quando o verify_token esta correto', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'challenge-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('challenge-123');
    });

    it('responde 403 quando o verify_token esta incorreto', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token-errado',
          'hub.challenge': 'challenge-123',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /webhook/whatsapp (validacao de assinatura HMAC)', () => {
    it('processa o evento e responde EVENT_RECEIVED quando a assinatura e valida', async () => {
      findUniqueMock.mockResolvedValue(null);
      const rawBody = JSON.stringify(buildMensagemPayload('wamid.valido-1'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': assinar(rawBody),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('EVENT_RECEIVED');
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledTimes(1);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledWith(
        '5511999999999',
        expect.objectContaining({ waMessageId: 'wamid.valido-1' }),
      );
    });

    it('responde 401 quando a assinatura HMAC e invalida', async () => {
      const rawBody = JSON.stringify(buildMensagemPayload('wamid.invalido-1'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': assinar(rawBody, 'secret-errado'),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(401);
      expect(enqueueWhatsappConversaJobMock).not.toHaveBeenCalled();
    });

    it('responde 401 quando o header de assinatura esta ausente', async () => {
      const rawBody = JSON.stringify(buildMensagemPayload('wamid.sem-assinatura-1'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(401);
    });

    it('nao enfileira novamente uma segunda chamada com o mesmo whatsapp_message_id (idempotencia)', async () => {
      const rawBody = JSON.stringify(buildMensagemPayload('wamid.repetido-1'));
      const headers = {
        'content-type': 'application/json',
        'x-hub-signature-256': assinar(rawBody),
      };

      findUniqueMock.mockResolvedValueOnce(null);
      const primeira = await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers, payload: rawBody });

      findUniqueMock.mockResolvedValueOnce({ id: 'msg-1', whatsappMessageId: 'wamid.repetido-1' });
      const segunda = await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers, payload: rawBody });

      expect(primeira.statusCode).toBe(200);
      expect(segunda.statusCode).toBe(200);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /webhook/whatsapp (extracao de mensagem de audio)', () => {
    it('extrai o media id (mensagem.audio.id) como conteudo e tipo "audio", sem baixar a midia', async () => {
      findUniqueMock.mockResolvedValue(null);
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '5511988887777',
                      id: 'wamid.audio-1',
                      type: 'audio',
                      audio: { id: 'media-id-abc123', mime_type: 'audio/ogg; codecs=opus' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': assinar(rawBody),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledTimes(1);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledWith(
        '5511988887777',
        expect.objectContaining({
          waMessageId: 'wamid.audio-1',
          tipo: 'audio',
          conteudo: 'media-id-abc123',
        }),
      );
    });
  });

  describe('POST /webhook/whatsapp (extracao de mensagem de video)', () => {
    it('extrai o media id (mensagem.video.id) como conteudo e tipo "video", sem baixar a midia', async () => {
      findUniqueMock.mockResolvedValue(null);
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '5511977776666',
                      id: 'wamid.video-1',
                      type: 'video',
                      video: { id: 'media-id-video-abc', mime_type: 'video/mp4' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': assinar(rawBody),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledTimes(1);
      expect(enqueueWhatsappConversaJobMock).toHaveBeenCalledWith(
        '5511977776666',
        expect.objectContaining({
          waMessageId: 'wamid.video-1',
          tipo: 'video',
          conteudo: 'media-id-video-abc',
        }),
      );
    });
  });

  describe('assinaturaWebhookValida', () => {
    it('retorna false quando faltam header ou secret', () => {
      expect(assinaturaWebhookValida('body', undefined, APP_SECRET)).toBe(false);
      expect(assinaturaWebhookValida('body', 'sha256=abc', undefined)).toBe(false);
    });

    it('retorna false para esquema diferente de sha256', () => {
      expect(assinaturaWebhookValida('body', 'sha1=abc', APP_SECRET)).toBe(false);
    });
  });
});
