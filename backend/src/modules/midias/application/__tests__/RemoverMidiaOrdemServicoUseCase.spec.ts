import { describe, expect, it } from 'vitest';
import { RemoverMidiaOrdemServicoUseCase } from '../RemoverMidiaOrdemServicoUseCase';
import { MidiaNaoEncontradaError } from '../../domain/errors/MidiaNaoEncontradaError';
import { criarMidiaFake, FakeArmazenamentoArquivoService, FakeMidiaOrdemServicoRepository } from './fakes';

describe('RemoverMidiaOrdemServicoUseCase', () => {
  it('remove o arquivo fisico e o registro', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const armazenamentoArquivoService = new FakeArmazenamentoArquivoService();

    armazenamentoArquivoService.arquivos.set('videos/chave-1', Buffer.from('video'));
    midiaOrdemServicoRepository.seed(
      criarMidiaFake({ id: 'midia-1', caminhoArmazenamento: 'videos/chave-1' }),
    );

    const useCase = new RemoverMidiaOrdemServicoUseCase({
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
    });

    await useCase.execute('midia-1');

    expect(armazenamentoArquivoService.arquivos.has('videos/chave-1')).toBe(false);
    expect(await midiaOrdemServicoRepository.findById('midia-1')).toBeNull();
  });

  it('lanca MidiaNaoEncontradaError quando o id nao existe', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const armazenamentoArquivoService = new FakeArmazenamentoArquivoService();
    const useCase = new RemoverMidiaOrdemServicoUseCase({
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
    });

    await expect(useCase.execute('inexistente')).rejects.toBeInstanceOf(MidiaNaoEncontradaError);
  });
});
