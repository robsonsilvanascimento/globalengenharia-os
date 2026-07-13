import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT } from '../../../../shared/domain/events/OSStatusAlterado';
import { TECNICO_ATRIBUIDO_OS_EVENT, type TecnicoAtribuidoOS } from '../../../../shared/domain/events/TecnicoAtribuidoOS';
import { AtribuirTecnicoUseCase } from '../AtribuirTecnicoUseCase';
import { VerificarDisponibilidadeUseCase } from '../VerificarDisponibilidadeUseCase';
import { AjudanteIndisponivelError } from '../../domain/errors/AjudanteIndisponivelError';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { TecnicoIndisponivelError } from '../../domain/errors/TecnicoIndisponivelError';
import { criarOrdemServicoFake, FakeHistoricoStatusOSRepository, FakeOrdemServicoRepository } from './fakes';

function criarUseCase() {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
  const verificarDisponibilidadeUseCase = new VerificarDisponibilidadeUseCase({ ordemServicoRepository });
  const eventBus = new EventBus();

  const useCase = new AtribuirTecnicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    verificarDisponibilidadeUseCase,
    eventBus,
  });

  return { useCase, ordemServicoRepository, historicoStatusOSRepository, verificarDisponibilidadeUseCase, eventBus };
}

describe('AtribuirTecnicoUseCase', () => {
  it('atribui o tecnico e muda o status para "atribuida" quando a OS ainda nao esta atribuida', async () => {
    const { useCase, ordemServicoRepository, historicoStatusOSRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'triagem' }));

    const listener = vi.fn();
    eventBus.subscribe(OS_STATUS_ALTERADO_EVENT, listener);

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      usuarioId: 'atendente-1',
    });

    expect(ordemAtualizada.status).toBe('atribuida');
    expect(ordemAtualizada.tecnicoId).toBe('tecnico-1');
    expect(historicoStatusOSRepository.historicos).toHaveLength(1);
    expect(historicoStatusOSRepository.historicos[0]).toMatchObject({
      statusAnterior: 'triagem',
      statusNovo: 'atribuida',
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('nao publica evento quando a OS ja estava atribuida (apenas reatribui o tecnico)', async () => {
    const { useCase, ordemServicoRepository, historicoStatusOSRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', status: 'atribuida', tecnicoId: 'tecnico-antigo' }),
    );

    const listener = vi.fn();
    eventBus.subscribe(OS_STATUS_ALTERADO_EVENT, listener);

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-novo',
      usuarioId: 'atendente-1',
    });

    expect(ordemAtualizada.tecnicoId).toBe('tecnico-novo');
    expect(ordemAtualizada.status).toBe('atribuida');
    // Historico ainda e gravado (registra a reatribuicao), mas sem publicar evento de mudanca de status.
    expect(historicoStatusOSRepository.historicos).toHaveLength(1);

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).not.toHaveBeenCalled();
  });

  it('lanca OrdemServicoNaoEncontradaError quando a OS nao existe', async () => {
    const { useCase } = criarUseCase();

    await expect(
      useCase.execute({ ordemServicoId: 'os-inexistente', tecnicoId: 'tecnico-1', usuarioId: 'atendente-1' }),
    ).rejects.toBeInstanceOf(OrdemServicoNaoEncontradaError);
  });

  it('quando dataAgendada e informada, atualiza o campo e publica TecnicoAtribuidoOS', async () => {
    const { useCase, ordemServicoRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', clienteId: 'cliente-1', status: 'triagem' }),
    );

    const listener = vi.fn();
    eventBus.subscribe<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, listener);

    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      usuarioId: 'atendente-1',
      dataAgendada,
    });

    expect(ordemAtualizada.dataAgendada).toEqual(dataAgendada);

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        tecnicoId: 'tecnico-1',
        clienteId: 'cliente-1',
        timestamp: expect.any(Date),
      }),
    );
  });

  it('quando dataAgendada nao e informada, nao altera o campo mas ainda publica TecnicoAtribuidoOS', async () => {
    const { useCase, ordemServicoRepository, eventBus } = criarUseCase();
    const dataOriginal = new Date('2026-01-01T00:00:00.000Z');
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', status: 'triagem', dataAgendada: dataOriginal }),
    );

    const listener = vi.fn();
    eventBus.subscribe<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, listener);

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      usuarioId: 'atendente-1',
    });

    expect(ordemAtualizada.dataAgendada).toEqual(dataOriginal);

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('funciona sem eventBus informado (compatibilidade) e nao lanca erro', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
    const verificarDisponibilidadeUseCase = new VerificarDisponibilidadeUseCase({ ordemServicoRepository });
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'triagem' }));

    const useCaseSemEventBus = new AtribuirTecnicoUseCase({
      ordemServicoRepository,
      historicoStatusOSRepository,
      verificarDisponibilidadeUseCase,
    });

    const ordemAtualizada = await useCaseSemEventBus.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      usuarioId: 'atendente-1',
    });

    expect(ordemAtualizada.status).toBe('atribuida');
    expect(ordemAtualizada.tecnicoId).toBe('tecnico-1');
  });

  it('atribui tecnico disponivel com sucesso quando ha dataAgendada', async () => {
    const { useCase, ordemServicoRepository } = criarUseCase();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'triagem' }));

    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      usuarioId: 'atendente-1',
      dataAgendada,
    });

    expect(ordemAtualizada.tecnicoId).toBe('tecnico-1');
    expect(ordemAtualizada.status).toBe('atribuida');
  });

  it('lanca TecnicoIndisponivelError quando o tecnico ja tem OS agendada no mesmo horario', async () => {
    const { useCase, ordemServicoRepository } = criarUseCase();
    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-outra',
        tecnicoId: 'tecnico-1',
        dataAgendada,
        status: 'atribuida',
      }),
    );
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'triagem' }));

    await expect(
      useCase.execute({
        ordemServicoId: 'os-1',
        tecnicoId: 'tecnico-1',
        usuarioId: 'atendente-1',
        dataAgendada,
      }),
    ).rejects.toBeInstanceOf(TecnicoIndisponivelError);
  });

  it('atribui tecnico e ajudante disponiveis com sucesso e publica evento com ajudanteId', async () => {
    const { useCase, ordemServicoRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', clienteId: 'cliente-1', status: 'triagem' }),
    );

    const listener = vi.fn();
    eventBus.subscribe<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, listener);

    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      tecnicoId: 'tecnico-1',
      ajudanteId: 'ajudante-1',
      usuarioId: 'atendente-1',
      dataAgendada,
    });

    expect(ordemAtualizada.tecnicoId).toBe('tecnico-1');
    expect(ordemAtualizada.ajudanteId).toBe('ajudante-1');

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        tecnicoId: 'tecnico-1',
        ajudanteId: 'ajudante-1',
      }),
    );
  });

  it('lanca AjudanteIndisponivelError quando o ajudante ja tem OS agendada no mesmo horario', async () => {
    const { useCase, ordemServicoRepository } = criarUseCase();
    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-outra',
        ajudanteId: 'ajudante-1',
        dataAgendada,
        status: 'atribuida',
      }),
    );
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'triagem' }));

    await expect(
      useCase.execute({
        ordemServicoId: 'os-1',
        tecnicoId: 'tecnico-1',
        ajudanteId: 'ajudante-1',
        usuarioId: 'atendente-1',
        dataAgendada,
      }),
    ).rejects.toBeInstanceOf(AjudanteIndisponivelError);
  });

  it('valida disponibilidade do tecnico usando a dataAgendada ja existente na OS quando nenhuma nova e informada', async () => {
    const { useCase, ordemServicoRepository } = criarUseCase();
    const dataAgendada = new Date('2026-08-01T10:00:00.000Z');
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-outra',
        tecnicoId: 'tecnico-1',
        dataAgendada,
        status: 'atribuida',
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', status: 'triagem', dataAgendada }),
    );

    await expect(
      useCase.execute({
        ordemServicoId: 'os-1',
        tecnicoId: 'tecnico-1',
        usuarioId: 'atendente-1',
      }),
    ).rejects.toBeInstanceOf(TecnicoIndisponivelError);
  });
});
