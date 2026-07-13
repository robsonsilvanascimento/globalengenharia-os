import { describe, expect, it } from 'vitest';
import { CriarMidiaOrdemServicoUseCase } from '../CriarMidiaOrdemServicoUseCase';
import { FakeArmazenamentoArquivoService, FakeMidiaOrdemServicoRepository } from './fakes';

describe('CriarMidiaOrdemServicoUseCase', () => {
  it('salva o arquivo fisico na subpasta videos e cria o registro com a chave retornada', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const armazenamentoArquivoService = new FakeArmazenamentoArquivoService();
    const useCase = new CriarMidiaOrdemServicoUseCase({
      midiaOrdemServicoRepository,
      armazenamentoArquivoService,
    });

    const buffer = Buffer.from('conteudo-do-video');
    const midia = await useCase.execute({
      ordemServicoId: 'os-1',
      clienteId: 'cliente-1',
      tipo: 'video',
      buffer,
      nomeArquivo: 'video.mp4',
      mimeType: 'video/mp4',
      whatsappMediaId: 'wa-media-1',
    });

    expect(midia.ordemServicoId).toBe('os-1');
    expect(midia.clienteId).toBe('cliente-1');
    expect(midia.tipo).toBe('video');
    expect(midia.mimeType).toBe('video/mp4');
    expect(midia.tamanhoBytes).toBe(buffer.length);
    expect(midia.whatsappMediaId).toBe('wa-media-1');
    expect(midia.caminhoArmazenamento).toContain('videos/');

    const arquivoSalvo = await armazenamentoArquivoService.lerArquivo(midia.caminhoArmazenamento);
    expect(arquivoSalvo.equals(buffer)).toBe(true);

    const registrado = await midiaOrdemServicoRepository.findById(midia.id);
    expect(registrado).toMatchObject({ id: midia.id, caminhoArmazenamento: midia.caminhoArmazenamento });
  });
});
