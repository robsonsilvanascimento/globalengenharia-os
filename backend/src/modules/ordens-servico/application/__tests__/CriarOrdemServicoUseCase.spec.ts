import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../../shared/domain/EventBus';
import { OS_CRIADA_EVENT, type OSCriada } from '../../../../shared/domain/events/OSCriada';
import { CriarOrdemServicoUseCase } from '../CriarOrdemServicoUseCase';
import {
  FakeHistoricoStatusOSRepository,
  FakeNumeroOSGenerator,
  FakeOrdemServicoRepository,
} from './fakes';

function criarUseCase() {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
  const numeroOSGenerator = new FakeNumeroOSGenerator();
  const eventBus = new EventBus();

  const useCase = new CriarOrdemServicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    numeroOSGenerator,
    eventBus,
  });

  return { useCase, ordemServicoRepository, historicoStatusOSRepository, numeroOSGenerator, eventBus };
}

describe('CriarOrdemServicoUseCase', () => {
  it('cria a OS com status inicial "aberta" e numero unico gerado pelo NumeroOSGenerator', async () => {
    const { useCase } = criarUseCase();

    const ordemServico = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Disjuntor desarmando',
      criadoPorUsuarioId: 'usuario-1',
      criadoVia: 'painel',
    });

    expect(ordemServico.status).toBe('aberta');
    expect(ordemServico.numero).toMatch(/^\d{4}\d{2}\d{2,}$/);
  });

  it('gera numeros unicos e sequenciais para OSs criadas em sequencia', async () => {
    const { useCase } = criarUseCase();

    const primeira = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Problema 1',
      criadoPorUsuarioId: 'usuario-1',
      criadoVia: 'painel',
    });
    const segunda = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Problema 2',
      criadoPorUsuarioId: 'usuario-1',
      criadoVia: 'painel',
    });

    expect(primeira.numero).not.toBe(segunda.numero);
  });

  it('grava o historico inicial (statusAnterior undefined -> statusNovo "aberta")', async () => {
    const { useCase, historicoStatusOSRepository } = criarUseCase();

    const ordemServico = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Disjuntor desarmando',
      criadoPorUsuarioId: 'usuario-1',
      criadoVia: 'painel',
    });

    expect(historicoStatusOSRepository.historicos).toHaveLength(1);
    expect(historicoStatusOSRepository.historicos[0]).toMatchObject({
      ordemServicoId: ordemServico.id,
      statusAnterior: undefined,
      statusNovo: 'aberta',
      alteradoPorBot: false,
    });
  });

  it('marca alteradoPorBot=true quando criadoPorUsuarioId nao e informado (fluxo whatsapp/bot)', async () => {
    const { useCase, historicoStatusOSRepository } = criarUseCase();

    await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Problema via bot',
      criadoVia: 'whatsapp',
    });

    expect(historicoStatusOSRepository.historicos[0]?.alteradoPorBot).toBe(true);
  });

  it('usa prioridade "normal" como padrao quando nao informada', async () => {
    const { useCase } = criarUseCase();

    const ordemServico = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Problema sem prioridade',
      criadoVia: 'painel',
    });

    expect(ordemServico.prioridade).toBe('normal');
  });

  it('publica o evento OSCriada apos criar a OS com sucesso', async () => {
    const { useCase, eventBus } = criarUseCase();
    const handler = vi.fn();
    eventBus.subscribe<OSCriada>(OS_CRIADA_EVENT, handler);

    const ordemServico = await useCase.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Disjuntor desarmando',
      criadoPorUsuarioId: 'usuario-1',
      criadoVia: 'painel',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        ordemServicoId: ordemServico.id,
        clienteId: 'cliente-1',
        timestamp: expect.any(Date),
      }),
    );
  });

  it('nao lanca erro e nao publica nada quando eventBus nao e informado', async () => {
    const ordemServicoRepository = new FakeOrdemServicoRepository();
    const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
    const numeroOSGenerator = new FakeNumeroOSGenerator();
    const useCaseSemEventBus = new CriarOrdemServicoUseCase({
      ordemServicoRepository,
      historicoStatusOSRepository,
      numeroOSGenerator,
    });

    const ordemServico = await useCaseSemEventBus.execute({
      clienteId: 'cliente-1',
      categoriaServicoId: 'categoria-1',
      descricaoProblema: 'Disjuntor desarmando',
      criadoVia: 'painel',
    });

    expect(ordemServico.status).toBe('aberta');
  });
});
