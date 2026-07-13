import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { gerarAudio } from './GerarAudioService';

function criarClientFake(create: (...args: unknown[]) => unknown): OpenAI {
  return {
    audio: {
      speech: {
        create,
      },
    },
  } as unknown as OpenAI;
}

describe('GerarAudioService', () => {
  it('gera audio com sucesso e retorna Buffer com mimeType audio/ogg', async () => {
    const bytesFake = new Uint8Array([1, 2, 3, 4]);
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(bytesFake.buffer),
    });
    const client = criarClientFake(create);

    const resultado = await gerarAudio('Ola, sua ordem de servico foi concluida.', client);

    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.conteudo).toBeInstanceOf(Buffer);
      expect(Array.from(resultado.conteudo)).toEqual([1, 2, 3, 4]);
      expect(resultado.mimeType).toBe('audio/ogg');
    }
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Ola, sua ordem de servico foi concluida.',
        response_format: 'opus',
      }),
    );
  });

  it('retorna sucesso: false quando a API rejeita, sem lancar excecao', async () => {
    const create = vi.fn().mockRejectedValue(new Error('chave de API invalida'));
    const client = criarClientFake(create);

    const resultado = await gerarAudio('texto qualquer', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'chave de API invalida' });
  });

  it('retorna sucesso: false com erro nao-Error, sem lancar excecao', async () => {
    const create = vi.fn().mockRejectedValue('falha desconhecida de rede');
    const client = criarClientFake(create);

    const resultado = await gerarAudio('texto qualquer', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'falha desconhecida de rede' });
  });

  it('retorna sucesso: false para texto vazio, sem chamar a API', async () => {
    const create = vi.fn();
    const client = criarClientFake(create);

    const resultado = await gerarAudio('   ', client);

    expect(resultado).toEqual({ sucesso: false, erro: 'Texto vazio: nao ha o que converter em audio' });
    expect(create).not.toHaveBeenCalled();
  });
});
