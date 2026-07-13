import { describe, expect, it } from 'vitest';
import { ObterEstimativaCustoUseCase } from '../ObterEstimativaCustoUseCase';
import { FakeEstimativaCustoOSRepository } from './fakes';

describe('ObterEstimativaCustoUseCase', () => {
  it('retorna null quando a OS ainda nao possui estimativa calculada', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new ObterEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const resultado = await useCase.execute('os-sem-estimativa');

    expect(resultado).toBeNull();
  });

  it('retorna a estimativa existente da OS', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    estimativaCustoOSRepository.seed({
      id: 'estimativa-1',
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      custoAlmoco: 0,
      custoJanta: 0,
      custoEstadia: 0,
      turno: 'diurno',
      custoAdicionalNoturno: 0,
      outrosCustos: 0,
      custoTotal: 200,
      criadoPorUsuarioId: 'admin-1',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    const useCase = new ObterEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const resultado = await useCase.execute('os-1');

    expect(resultado?.custoTotal).toBe(200);
  });
});
