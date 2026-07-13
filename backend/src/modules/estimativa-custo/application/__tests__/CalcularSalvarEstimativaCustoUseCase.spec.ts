import { describe, expect, it } from 'vitest';
import { CalcularSalvarEstimativaCustoUseCase } from '../CalcularSalvarEstimativaCustoUseCase';
import { FakeEstimativaCustoOSRepository } from './fakes';

describe('CalcularSalvarEstimativaCustoUseCase', () => {
  it('calcula o custo total sem ajudante', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const estimativa = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      custoCombustivel: 30,
      custoPedagio: 10,
      custoDesgasteVeiculo: 20,
      outrosCustos: 5,
      criadoPorUsuarioId: 'admin-1',
    });

    // (4 * 50) + 30 + 10 + 20 + 5 = 265
    expect(estimativa.custoTotal).toBe(265);
    expect(estimativa.horasEstimadasAjudante).toBeUndefined();
    expect(estimativa.valorHoraAjudante).toBeUndefined();
    expect(estimativa.custoAlmoco).toBe(0);
    expect(estimativa.custoJanta).toBe(0);
    expect(estimativa.custoEstadia).toBe(0);
    expect(estimativa.turno).toBe('diurno');
    expect(estimativa.custoAdicionalNoturno).toBe(0);
  });

  it('calcula o custo total com ajudante', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const estimativa = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      horasEstimadasAjudante: 4,
      valorHoraAjudante: 25,
      custoCombustivel: 30,
      custoPedagio: 10,
      custoDesgasteVeiculo: 20,
      outrosCustos: 5,
      criadoPorUsuarioId: 'admin-1',
    });

    // (4 * 50) + (4 * 25) + 30 + 10 + 20 + 5 = 365
    expect(estimativa.custoTotal).toBe(365);
  });

  it('cria a estimativa na primeira chamada e atualiza na segunda (upsert)', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const primeira = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 2,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      outrosCustos: 0,
      criadoPorUsuarioId: 'admin-1',
    });
    expect(primeira.custoTotal).toBe(100);

    const segunda = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 3,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      outrosCustos: 0,
      criadoPorUsuarioId: 'admin-1',
    });

    expect(segunda.id).toBe(primeira.id);
    expect(segunda.custoTotal).toBe(150);

    const todas = await estimativaCustoOSRepository.findByOrdemServicoId('os-1');
    expect(todas?.custoTotal).toBe(150);
  });

  it('soma almoco, janta e estadia ao custo total', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const estimativa = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      custoCombustivel: 30,
      custoPedagio: 10,
      custoDesgasteVeiculo: 20,
      custoAlmoco: 15,
      custoJanta: 20,
      custoEstadia: 100,
      outrosCustos: 5,
      criadoPorUsuarioId: 'admin-1',
    });

    // (4 * 50) + 30 + 10 + 20 + 15 + 20 + 100 + 5 = 400
    expect(estimativa.custoTotal).toBe(400);
    expect(estimativa.custoAlmoco).toBe(15);
    expect(estimativa.custoJanta).toBe(20);
    expect(estimativa.custoEstadia).toBe(100);
  });

  it('turno noturno inclui custoAdicionalNoturno no custo total', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const estimativa = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      outrosCustos: 0,
      turno: 'noturno',
      custoAdicionalNoturno: 50,
      criadoPorUsuarioId: 'admin-1',
    });

    // (4 * 50) + 50 = 250
    expect(estimativa.custoTotal).toBe(250);
    expect(estimativa.turno).toBe('noturno');
    expect(estimativa.custoAdicionalNoturno).toBe(50);
  });

  it('turno diurno (ou ausente) nao inclui custoAdicionalNoturno no custo total mesmo informado', async () => {
    const estimativaCustoOSRepository = new FakeEstimativaCustoOSRepository();
    const useCase = new CalcularSalvarEstimativaCustoUseCase({ estimativaCustoOSRepository });

    const estimativa = await useCase.execute({
      ordemServicoId: 'os-1',
      horasEstimadasTecnico: 4,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      outrosCustos: 0,
      turno: 'diurno',
      custoAdicionalNoturno: 50,
      criadoPorUsuarioId: 'admin-1',
    });

    // (4 * 50) = 200 — custoAdicionalNoturno persistido mas nao somado
    expect(estimativa.custoTotal).toBe(200);
    expect(estimativa.turno).toBe('diurno');
    expect(estimativa.custoAdicionalNoturno).toBe(50);

    const semTurnoInformado = await useCase.execute({
      ordemServicoId: 'os-2',
      horasEstimadasTecnico: 2,
      valorHoraTecnico: 50,
      custoCombustivel: 0,
      custoPedagio: 0,
      custoDesgasteVeiculo: 0,
      outrosCustos: 0,
      custoAdicionalNoturno: 999,
      criadoPorUsuarioId: 'admin-1',
    });

    expect(semTurnoInformado.custoTotal).toBe(100);
    expect(semTurnoInformado.turno).toBe('diurno');
  });
});
