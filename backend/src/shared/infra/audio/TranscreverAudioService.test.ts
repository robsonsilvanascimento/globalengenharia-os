import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { transcreverAudio } from './TranscreverAudioService';

function criarOpenAiClientFake(create: (params: unknown) => Promise<unknown>): OpenAI {
  return {
    audio: {
      transcriptions: {
        create,
      },
    },
  } as unknown as OpenAI;
}

describe('transcreverAudio', () => {
  it('transcreve audio com sucesso e retorna o texto', async () => {
    const create = vi.fn().mockResolvedValue({ text: 'Ola, gostaria de agendar uma visita.' });
    const client = criarOpenAiClientFake(create);

    const resultado = await transcreverAudio(Buffer.from('conteudo-audio'), 'audio/ogg', client);

    expect(resultado).toEqual({ sucesso: true, texto: 'Ola, gostaria de agendar uma visita.' });
    expect(create).toHaveBeenCalledTimes(1);

    const params = create.mock.calls[0][0] as { model: string; file: { name?: string } };
    expect(params.model).toBe('whisper-1');
  });

  it('usa o modelo definido em OPENAI_STT_MODEL quando informado', async () => {
    const originalModel = process.env.OPENAI_STT_MODEL;
    process.env.OPENAI_STT_MODEL = 'whisper-large-v3';

    try {
      const create = vi.fn().mockResolvedValue({ text: 'texto transcrito' });
      const client = criarOpenAiClientFake(create);

      await transcreverAudio(Buffer.from('conteudo'), 'audio/ogg', client);

      const params = create.mock.calls[0][0] as { model: string };
      expect(params.model).toBe('whisper-large-v3');
    } finally {
      if (originalModel === undefined) {
        delete process.env.OPENAI_STT_MODEL;
      } else {
        process.env.OPENAI_STT_MODEL = originalModel;
      }
    }
  });

  it.each([
    ['audio/ogg', 'ogg'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp4', 'mp4'],
    ['audio/amr', 'amr'],
  ])('gera arquivo com extensao correta para mimeType %s', async (mimeType, extensaoEsperada) => {
    const create = vi.fn().mockResolvedValue({ text: 'texto' });
    const client = criarOpenAiClientFake(create);

    await transcreverAudio(Buffer.from('conteudo'), mimeType, client);

    const params = create.mock.calls[0][0] as { file: { name?: string } };
    expect(params.file.name).toBe(`audio.${extensaoEsperada}`);
  });

  it('retorna sucesso: false quando a API lanca excecao (chave invalida, rate limit, etc.), sem lancar', async () => {
    const create = vi.fn().mockRejectedValue(new Error('Incorrect API key provided'));
    const client = criarOpenAiClientFake(create);

    const resultado = await transcreverAudio(Buffer.from('conteudo'), 'audio/ogg', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'Incorrect API key provided' });
  });

  it('retorna sucesso: false quando a transcricao retornada esta vazia', async () => {
    const create = vi.fn().mockResolvedValue({ text: '   ' });
    const client = criarOpenAiClientFake(create);

    const resultado = await transcreverAudio(Buffer.from('conteudo'), 'audio/ogg', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'Transcricao vazia retornada pela API' });
  });

  it('retorna sucesso: false para erro sem instancia de Error', async () => {
    const create = vi.fn().mockRejectedValue('falha desconhecida');
    const client = criarOpenAiClientFake(create);

    const resultado = await transcreverAudio(Buffer.from('conteudo'), 'audio/ogg', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'Erro desconhecido ao transcrever audio' });
  });
});
