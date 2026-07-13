import { describe, expect, it } from 'vitest';
import { ListarMidiasOrdemServicoUseCase } from '../ListarMidiasOrdemServicoUseCase';
import { criarMidiaFake, FakeMidiaOrdemServicoRepository } from './fakes';

describe('ListarMidiasOrdemServicoUseCase', () => {
  it('lista apenas as midias da OS informada', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    midiaOrdemServicoRepository.seed(criarMidiaFake({ id: 'midia-1', ordemServicoId: 'os-1' }));
    midiaOrdemServicoRepository.seed(criarMidiaFake({ id: 'midia-2', ordemServicoId: 'os-1' }));
    midiaOrdemServicoRepository.seed(criarMidiaFake({ id: 'midia-3', ordemServicoId: 'os-2' }));

    const useCase = new ListarMidiasOrdemServicoUseCase({ midiaOrdemServicoRepository });
    const midias = await useCase.execute('os-1');

    expect(midias).toHaveLength(2);
    expect(midias.map((midia) => midia.id).sort()).toEqual(['midia-1', 'midia-2']);
  });

  it('retorna lista vazia quando a OS nao possui midias', async () => {
    const midiaOrdemServicoRepository = new FakeMidiaOrdemServicoRepository();
    const useCase = new ListarMidiasOrdemServicoUseCase({ midiaOrdemServicoRepository });

    const midias = await useCase.execute('os-sem-midias');

    expect(midias).toEqual([]);
  });
});
