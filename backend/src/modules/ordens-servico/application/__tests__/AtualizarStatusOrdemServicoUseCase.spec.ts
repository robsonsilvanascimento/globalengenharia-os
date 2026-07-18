import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../../shared/domain/events/OSStatusAlterado';
import { AtualizarStatusOrdemServicoUseCase } from '../AtualizarStatusOrdemServicoUseCase';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { TransicaoInvalidaError } from '../../domain/errors/TransicaoInvalidaError';
import { criarOrdemServicoFake, FakeHistoricoStatusOSRepository, FakeOrdemServicoRepository } from './fakes';

function criarUseCase() {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
  const eventBus = new EventBus();

  const useCase = new AtualizarStatusOrdemServicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    eventBus,
  });

  return { useCase, ordemServicoRepository, historicoStatusOSRepository, eventBus };
}

describe('AtualizarStatusOrdemServicoUseCase', () => {
  it('aplica uma transicao valida, atualiza o status, grava historico e publica o evento OSStatusAlterado', async () => {
    const { useCase, ordemServicoRepository, historicoStatusOSRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'aberta' }));

    const listener = vi.fn<(event: OSStatusAlterado) => void>();
    eventBus.subscribe(OS_STATUS_ALTERADO_EVENT, listener);

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      statusNovo: 'triagem',
      papelUsuario: 'atendente',
      usuarioId: 'usuario-1',
    });

    expect(ordemAtualizada.status).toBe('triagem');
    expect(historicoStatusOSRepository.historicos).toHaveLength(1);
    expect(historicoStatusOSRepository.historicos[0]).toMatchObject({
      statusAnterior: 'aberta',
      statusNovo: 'triagem',
      alteradoPorUsuarioId: 'usuario-1',
    });

    // EventBus.publish dispara o handler de forma assincrona internamente; aguarda a proxima "tick".
    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: 'os-1',
        statusAnterior: 'aberta',
        statusNovo: 'triagem',
      }),
    );
  });

  it('seta fechadoEm quando o novo status e "concluida"', async () => {
    const { useCase, ordemServicoRepository } = criarUseCase();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'em_andamento' }));

    const ordemAtualizada = await useCase.execute({
      ordemServicoId: 'os-1',
      statusNovo: 'concluida',
      papelUsuario: 'tecnico',
      usuarioId: 'tecnico-1',
    });

    expect(ordemAtualizada.status).toBe('concluida');
    expect(ordemAtualizada.fechadoEm).toBeInstanceOf(Date);
  });

  it('lanca TransicaoInvalidaError e nao persiste nem publica evento quando a transicao nao e permitida', async () => {
    const { useCase, ordemServicoRepository, historicoStatusOSRepository, eventBus } = criarUseCase();
    ordemServicoRepository.seed(criarOrdemServicoFake({ id: 'os-1', status: 'aberta' }));

    const listener = vi.fn();
    eventBus.subscribe(OS_STATUS_ALTERADO_EVENT, listener);

    await expect(
      useCase.execute({
        ordemServicoId: 'os-1',
        statusNovo: 'atribuida', // pula etapa (aberta -> atribuida nao e permitido)
        papelUsuario: 'atendente',
        usuarioId: 'usuario-1',
      }),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);

    const ordemServico = await ordemServicoRepository.findById('os-1');
    expect(ordemServico?.status).toBe('aberta');
    expect(historicoStatusOSRepository.historicos).toHaveLength(0);

    await new Promise((resolve) => setImmediate(resolve));
    expect(listener).not.toHaveBeenCalled();
  });

  it('lanca OrdemServicoNaoEncontradaError quando a OS nao existe', async () => {
    const { useCase } = criarUseCase();

    await expect(
      useCase.execute({
        ordemServicoId: 'os-inexistente',
        statusNovo: 'triagem',
        papelUsuario: 'atendente',
      }),
    ).rejects.toBeInstanceOf(OrdemServicoNaoEncontradaError);
  });

  describe('regra de orcamento obrigatorio em emergencia', () => {
    function criarUseCaseComOrcamento(aprovado: boolean) {
      const ordemServicoRepository = new FakeOrdemServicoRepository();
      const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
      const eventBus = new EventBus();
      const useCase = new AtualizarStatusOrdemServicoUseCase({
        ordemServicoRepository,
        historicoStatusOSRepository,
        eventBus,
        orcamentoAprovado: async () => aprovado,
      });
      return { useCase, ordemServicoRepository };
    }

    it('bloqueia iniciar execucao de OS de emergencia sem orcamento aprovado', async () => {
      const { useCase, ordemServicoRepository } = criarUseCaseComOrcamento(false);
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', status: 'atribuida', tipoChamado: 'emergencia' }),
      );

      await expect(
        useCase.execute({
          ordemServicoId: 'os-1',
          statusNovo: 'em_andamento',
          papelUsuario: 'tecnico',
          usuarioId: 'tecnico-1',
        }),
      ).rejects.toThrow();

      const os = await ordemServicoRepository.findById('os-1');
      expect(os?.status).toBe('atribuida');
    });

    it('permite iniciar execucao de OS de emergencia com orcamento aprovado', async () => {
      const { useCase, ordemServicoRepository } = criarUseCaseComOrcamento(true);
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', status: 'atribuida', tipoChamado: 'emergencia' }),
      );

      const atualizada = await useCase.execute({
        ordemServicoId: 'os-1',
        statusNovo: 'em_andamento',
        papelUsuario: 'tecnico',
        usuarioId: 'tecnico-1',
      });

      expect(atualizada.status).toBe('em_andamento');
    });

    it('nao aplica a regra para chamado de servico (sem orcamento aprovado)', async () => {
      const { useCase, ordemServicoRepository } = criarUseCaseComOrcamento(false);
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', status: 'atribuida', tipoChamado: 'servico' }),
      );

      const atualizada = await useCase.execute({
        ordemServicoId: 'os-1',
        statusNovo: 'em_andamento',
        papelUsuario: 'tecnico',
        usuarioId: 'tecnico-1',
      });

      expect(atualizada.status).toBe('em_andamento');
    });
  });
});
