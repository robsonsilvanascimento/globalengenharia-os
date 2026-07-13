import { describe, expect, it } from 'vitest';
import { ObterArquivoMidiaUseCase } from '../ObterArquivoMidiaUseCase';
import { MidiaNaoEncontradaError } from '../../domain/errors/MidiaNaoEncontradaError';
import { criarMidiaFake, FakeArmazenamentoArquivoService, FakeMidiaOrdemServicoRepository } from './fakes';

describe('ObterArquivoMidiaUseCase', () => {
  it('retorna a midia e o conteudo binario correto do arquivo', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const armazenamentoArquivoService = new FakeArmazenamentoArquivoService();

    const conteudo = Buffer.from('conteudo-binario-do-video');
    armazenamentoArquivoService.arquivos.set('videos/chave-1', conteudo);
    midiaOrdemServicoRepository.seed(
      criarMidiaFake({ id: 'midia-1', caminhoArmazenamento: 'videos/chave-1' }),
    );

    const useCase = new ObterArquivoMidiaUseCase({
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
    });

    const resultado = await useCase.execute('midia-1');

    expect(resultado.midia.id).toBe('midia-1');
    expect(resultado.conteudo.equals(conteudo)).toBe(true);
  });

  it('lanca MidiaNaoEncontradaError quando o id nao existe', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const armazenamentoArquivoService = new FakeArmazenamentoArquivoService();
    const useCase = new ObterArquivoMidiaUseCase({
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
    });

    await expect(useCase.execute('inexistente')).rejects.toBeInstanceOf(MidiaNaoEncontradaError);
  });
});
