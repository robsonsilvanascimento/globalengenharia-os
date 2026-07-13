import { describe, expect, it } from 'vitest';
import { ListarHistoricoOSUseCase } from '../ListarHistoricoOSUseCase';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { criarOrdemServicoFake, FakeHistoricoStatusOSRepository, FakeOrdemServicoRepository } from './fakes';

describe('ListarHistoricoOSUseCase', () => {
  it('lista o historico da OS informada', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1' }));

    const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
    await historicoStatusOSRepository.create({
      ordemServicoId: 'os-1',
      statusAnterior: undefined,
      statusNovo: 'aberta',
      alteradoPorBot: false,
    });

    const useCase = new ListarHistoricoOSUseCase({ ordemServicoRepository, historicoStatusOSRepository });

    const resultado = await useCase.execute({ ordemServicoId: 'os-1' });

    expect(resultado.total).toBe(1);
    expect(resultado.itens[0]).toMatchObject({ ordemServicoId: 'os-1', statusNovo: 'aberta' });
  });

  it('lanca OrdemServicoNaoEncontradaError quando a OS nao existe', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
    const useCase = new ListarHistoricoOSUseCase({ ordemServicoRepository, historicoStatusOSRepository });

    await expect(useCase.execute({ ordemServicoId: 'os-inexistente' })).rejects.toBeInstanceOf(
      OrdemServicoNaoEncontradaError,
    );
  });
});
