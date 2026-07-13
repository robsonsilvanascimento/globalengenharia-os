import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  enviarTexto,
  enviarTemplate,
  enviarMenuCategorias,
  enviarDocumento,
  uploadMedia,
  enviarAudio,
  marcarComoLidoEDigitando,
  baixarMedia,
} from './MetaCloudApiClient';

function mockFetchResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('MetaCloudApiClient', () => {
  beforeEach(() => {
    process.env.META_WHATSAPP_TOKEN = 'token-de-teste';
    process.env.META_PHONE_NUMBER_ID = '123456';
  });

  it('envia texto com sucesso', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockFetchResponse(200, { messages: [{ id: 'wamid.abc123' }] }),
    );

    const resultado = await enviarTexto('5511999999999', 'Ola, tudo bem?', fetchFn as unknown as typeof fetch);

    expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.abc123' });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/123456/messages');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer token-de-teste');

    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'text',
      text: { body: 'Ola, tudo bem?' },
    });
  });

  it('envia template com sucesso', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockFetchResponse(200, { messages: [{ id: 'wamid.template-1' }] }),
    );

    const resultado = await enviarTemplate(
      '5511999999999',
      'confirmacao_agendamento',
      ['Joao', '12/07/2026'],
      fetchFn as unknown as typeof fetch,
    );

    expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.template-1' });

    const [, options] = fetchFn.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.type).toBe('template');
    expect(payload.template).toEqual({
      name: 'confirmacao_agendamento',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Joao' },
            { type: 'text', text: '12/07/2026' },
          ],
        },
      ],
    });
  });

  it('envia menu de categorias como interactive list message', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockFetchResponse(200, { messages: [{ id: 'wamid.menu-1' }] }),
    );

    const resultado = await enviarMenuCategorias(
      '5511999999999',
      [
        { id: 'cat-1', nome: 'Eletrica' },
        { id: 'cat-2', nome: 'Hidraulica' },
      ],
      fetchFn as unknown as typeof fetch,
    );

    expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.menu-1' });

    const [, options] = fetchFn.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.type).toBe('interactive');
    expect(payload.interactive.type).toBe('list');
    expect(payload.interactive.action.sections[0].rows).toEqual([
      { id: 'cat-1', title: 'Eletrica' },
      { id: 'cat-2', title: 'Hidraulica' },
    ]);
  });

  it('retorna sucesso: false quando a Meta responde com erro HTTP 400, sem lancar excecao', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockFetchResponse(400, {
        error: {
          message: 'Invalid parameter',
          code: 100,
          error_subcode: 2388008,
          type: 'OAuthException',
        },
      }),
    );

    const resultado = await enviarTexto('numero-invalido', 'ola', fetchFn as unknown as typeof fetch);

    expect(resultado).toEqual({
      sucesso: false,
      erro: 'Invalid parameter',
      codigoErro: '100',
    });
  });

  it('retorna sucesso: false quando o fetch lanca erro de rede', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network timeout'));

    const resultado = await enviarTexto('5511999999999', 'ola', fetchFn as unknown as typeof fetch);

    expect(resultado).toEqual({ sucesso: false, erro: 'network timeout' });
  });

  describe('uploadMedia', () => {
    it('faz upload de midia com sucesso', async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockFetchResponse(200, { id: 'media-id-123' }));

      const resultado = await uploadMedia(
        Buffer.from('conteudo-pdf'),
        'relatorio.pdf',
        'application/pdf',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: true, mediaId: 'media-id-123' });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const [url, options] = fetchFn.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v19.0/123456/media');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer token-de-teste');
      expect(options.body).toBeInstanceOf(FormData);
    });

    it('retorna sucesso: false quando o upload falha com erro HTTP', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        mockFetchResponse(400, { error: { message: 'Unsupported media type', code: 100 } }),
      );

      const resultado = await uploadMedia(
        Buffer.from('conteudo'),
        'arquivo.pdf',
        'application/pdf',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: false, erro: 'Unsupported media type' });
    });
  });

  describe('enviarDocumento', () => {
    it('faz upload e envia o documento com sucesso', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockFetchResponse(200, { id: 'media-id-456' }))
        .mockResolvedValueOnce(mockFetchResponse(200, { messages: [{ id: 'wamid.doc-1' }] }));

      const resultado = await enviarDocumento(
        '5511999999999',
        Buffer.from('conteudo-pdf'),
        'orcamento.pdf',
        'application/pdf',
        'Segue o orcamento',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.doc-1' });
      expect(fetchFn).toHaveBeenCalledTimes(2);

      const [uploadUrl] = fetchFn.mock.calls[0];
      expect(uploadUrl).toBe('https://graph.facebook.com/v19.0/123456/media');

      const [messageUrl, messageOptions] = fetchFn.mock.calls[1];
      expect(messageUrl).toBe('https://graph.facebook.com/v19.0/123456/messages');
      const payload = JSON.parse(messageOptions.body);
      expect(payload).toMatchObject({
        type: 'document',
        document: {
          id: 'media-id-456',
          filename: 'orcamento.pdf',
          caption: 'Segue o orcamento',
        },
      });
    });

    it('nao tenta enviar a mensagem quando o upload de midia falha', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        mockFetchResponse(400, { error: { message: 'Invalid file' } }),
      );

      const resultado = await enviarDocumento(
        '5511999999999',
        Buffer.from('conteudo'),
        'arquivo.pdf',
        'application/pdf',
        undefined,
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: false, erro: 'Invalid file' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('retorna erro quando o upload funciona mas o envio da mensagem falha', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockFetchResponse(200, { id: 'media-id-789' }))
        .mockResolvedValueOnce(
          mockFetchResponse(400, { error: { message: 'Message failed to send', code: 131009 } }),
        );

      const resultado = await enviarDocumento(
        '5511999999999',
        Buffer.from('conteudo-pdf'),
        'nota.pdf',
        'application/pdf',
        undefined,
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({
        sucesso: false,
        erro: 'Message failed to send',
        codigoErro: '131009',
      });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('marcarComoLidoEDigitando', () => {
    it('marca mensagem como lida e digitando com sucesso', async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockFetchResponse(200, { success: true }));

      const resultado = await marcarComoLidoEDigitando('wamid.recebida-1', fetchFn as unknown as typeof fetch);

      expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.recebida-1' });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const [url, options] = fetchFn.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v19.0/123456/messages');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer token-de-teste');

      const payload = JSON.parse(options.body);
      expect(payload).toEqual({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: 'wamid.recebida-1',
        typing_indicator: { type: 'text' },
      });
    });

    it('retorna sucesso: false quando a Meta responde com erro HTTP', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        mockFetchResponse(400, { error: { message: 'Message not found', code: 100 } }),
      );

      const resultado = await marcarComoLidoEDigitando('wamid.inexistente', fetchFn as unknown as typeof fetch);

      expect(resultado).toEqual({
        sucesso: false,
        erro: 'Message not found',
        codigoErro: '100',
      });
    });

    it('retorna sucesso: false quando o fetch lanca erro de rede', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('network timeout'));

      const resultado = await marcarComoLidoEDigitando('wamid.qualquer', fetchFn as unknown as typeof fetch);

      expect(resultado).toEqual({ sucesso: false, erro: 'network timeout' });
    });
  });

  describe('baixarMedia', () => {
    function mockDownloadResponse(status: number, arrayBuffer: ArrayBuffer) {
      return {
        ok: status >= 200 && status < 300,
        status,
        arrayBuffer: async () => arrayBuffer,
      } as unknown as Response;
    }

    it('baixa a midia com sucesso, encadeando as 2 chamadas', async () => {
      const conteudoBinario = Buffer.from('conteudo-do-audio');
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(
          mockFetchResponse(200, {
            url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/media-1',
            mime_type: 'audio/ogg',
          }),
        )
        .mockResolvedValueOnce(
          mockDownloadResponse(200, conteudoBinario.buffer.slice(
            conteudoBinario.byteOffset,
            conteudoBinario.byteOffset + conteudoBinario.byteLength,
          )),
        );

      const resultado = await baixarMedia('media-1', fetchFn as unknown as typeof fetch);

      expect(resultado.sucesso).toBe(true);
      if (resultado.sucesso) {
        expect(resultado.mimeType).toBe('audio/ogg');
        expect(resultado.conteudo).toEqual(conteudoBinario);
      }

      expect(fetchFn).toHaveBeenCalledTimes(2);

      const [infoUrl, infoOptions] = fetchFn.mock.calls[0];
      expect(infoUrl).toBe('https://graph.facebook.com/v19.0/media-1');
      expect(infoOptions.headers.Authorization).toBe('Bearer token-de-teste');

      const [downloadUrl, downloadOptions] = fetchFn.mock.calls[1];
      expect(downloadUrl).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/media-1');
      expect(downloadOptions.headers.Authorization).toBe('Bearer token-de-teste');
    });

    it('retorna erro e nao tenta a segunda chamada quando a primeira falha', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        mockFetchResponse(404, { error: { message: 'Media not found' } }),
      );

      const resultado = await baixarMedia('media-inexistente', fetchFn as unknown as typeof fetch);

      expect(resultado).toEqual({ sucesso: false, erro: 'Media not found' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('retorna erro quando a segunda chamada (download do binario) falha', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(
          mockFetchResponse(200, {
            url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/media-2',
            mime_type: 'image/jpeg',
          }),
        )
        .mockResolvedValueOnce(mockDownloadResponse(500, new ArrayBuffer(0)));

      const resultado = await baixarMedia('media-2', fetchFn as unknown as typeof fetch);

      expect(resultado).toEqual({ sucesso: false, erro: 'Erro HTTP 500 ao baixar midia' });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('enviarAudio', () => {
    it('faz upload e envia o audio com sucesso', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockFetchResponse(200, { id: 'media-id-audio-1' }))
        .mockResolvedValueOnce(mockFetchResponse(200, { messages: [{ id: 'wamid.audio-1' }] }));

      const resultado = await enviarAudio(
        '5511999999999',
        Buffer.from('conteudo-audio'),
        'audio/ogg',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: true, messageId: 'wamid.audio-1' });
      expect(fetchFn).toHaveBeenCalledTimes(2);

      const [uploadUrl] = fetchFn.mock.calls[0];
      expect(uploadUrl).toBe('https://graph.facebook.com/v19.0/123456/media');

      const [messageUrl, messageOptions] = fetchFn.mock.calls[1];
      expect(messageUrl).toBe('https://graph.facebook.com/v19.0/123456/messages');
      const payload = JSON.parse(messageOptions.body);
      expect(payload).toMatchObject({
        type: 'audio',
        audio: { id: 'media-id-audio-1' },
      });
      expect(payload.audio.filename).toBeUndefined();
      expect(payload.audio.caption).toBeUndefined();
    });

    it('nao tenta enviar a mensagem quando o upload de midia falha', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        mockFetchResponse(400, { error: { message: 'Invalid audio file' } }),
      );

      const resultado = await enviarAudio(
        '5511999999999',
        Buffer.from('conteudo'),
        'audio/ogg',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({ sucesso: false, erro: 'Invalid audio file' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('retorna erro quando o upload funciona mas o envio da mensagem falha', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockFetchResponse(200, { id: 'media-id-audio-2' }))
        .mockResolvedValueOnce(
          mockFetchResponse(400, { error: { message: 'Message failed to send', code: 131009 } }),
        );

      const resultado = await enviarAudio(
        '5511999999999',
        Buffer.from('conteudo-audio'),
        'audio/ogg',
        fetchFn as unknown as typeof fetch,
      );

      expect(resultado).toEqual({
        sucesso: false,
        erro: 'Message failed to send',
        codigoErro: '131009',
      });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });
});
