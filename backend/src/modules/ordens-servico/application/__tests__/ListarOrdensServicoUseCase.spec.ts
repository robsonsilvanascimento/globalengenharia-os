import { describe, expect, it } from 'vitest';
import { ListarOrdensServicoUseCase } from '../ListarOrdensServicoUseCase';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from './fakes';

describe('ListarOrdensServicoUseCase', () => {
  it('filtra por status e pagina os resultados', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'aberta' }));
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-2', status: 'concluida' }));
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-3', status: 'aberta' }));

    const useCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });

    const resultado = await useCase.execute({ status: 'aberta' });

    expect(resultado.total).toBe(2);
    expect(resultado.itens.map((os) => os.id)).toEqual(['os-1', 'os-3']);
  });

  it('usa page=1 e pageSize=20 como padrao quando nao informados', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1' }));
    const useCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });

    const resultado = await useCase.execute();

    expect(resultado.itens).toHaveLength(1);
  });
});
