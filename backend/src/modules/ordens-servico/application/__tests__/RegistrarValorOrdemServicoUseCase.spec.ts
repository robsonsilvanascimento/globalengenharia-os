import { describe, expect, it } from 'vitest';
import { RegistrarValorOrdemServicoUseCase } from '../RegistrarValorOrdemServicoUseCase';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from './fakes';

describe('RegistrarValorOrdemServicoUseCase', () => {
  it('registra o valor cobrado de uma OS existente', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1' }));
    const useCase = new RegistrarValorOrdemServicoUseCase({ ordemServicoRepository });

    const ordemAtualizada = await useCase.execute({ ordemServicoId: 'os-1', valorCobrado: 150.5 });

    expect(ordemAtualizada.valorCobrado).toBe(150.5);
  });

  it('lanca OrdemServicoNaoEncontradaError quando a OS nao existe', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    const useCase = new RegistrarValorOrdemServicoUseCase({ ordemServicoRepository });

    await expect(
      useCase.execute({ ordemServicoId: 'os-inexistente', valorCobrado: 100 }),
    ).rejects.toBeInstanceOf(OrdemServicoNaoEncontradaError);
  });
});
