import { describe, expect, it } from 'vitest';
import { AtualizarOrdemServicoUseCase } from '../AtualizarOrdemServicoUseCase';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from './fakes';

describe('AtualizarOrdemServicoUseCase', () => {
  it('atualiza os campos gerais informados sem mexer no status', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'aberta' }));
    const useCase = new AtualizarOrdemServicoUseCase({ ordemServicoRepository });

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      descricaoProblema: 'Descricao atualizada',
      prioridade: 'urgente',
    });

    expect(ordemAtualizada.descricaoProblema).toBe('Descricao atualizada');
    expect(ordemAtualizada.prioridade).toBe('urgente');
    expect(ordemAtualizada.status).toBe('aberta');
  });

  it('lanca OrdemServicoNaoEncontradaError quando a OS nao existe', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    const useCase = new AtualizarOrdemServicoUseCase({ ordemServicoRepository });

    await expect(
      useCase.execute({ ordemServicoId: 'os-inexistente', descricaoProblema: 'x' }),
    ).rejects.toBeInstanceOf(OrdemServicoNaoEncontradaError);
  });
});
