import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../../shared/http/errors/AppError';
import { ResponderSolicitacaoAtendimentoUseCase } from '../ResponderSolicitacaoAtendimentoUseCase';
import {
  FakeCriarFaqEntry,
  FakeSolicitacaoAtendimentoRepository,
  criarSolicitacaoAtendimentoFake,
} from './fakes';

describe('ResponderSolicitacaoAtendimentoUseCase', () => {
  it('marca a solicitacao como respondida e nao cria FaqEntry quando salvarComoFaq=false', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({
        id: 'solicitacao-1',
        mensagemCliente: 'Voces atendem aos sabados?',
      }),
    );
    const criarFaqEntry = new FakeCriarFaqEntry();

    const useCase = new ResponderSolicitacaoAtendimentoUseCase({
      solicitacaoAtendimentoRepository,
      criarFaqEntry,
    });

    const resultado = await useCase.execute({
      solicitacaoId: 'solicitacao-1',
      respostaTexto: 'Sim, aos sabados das 8h as 12h.',
      respondidoPorUsuarioId: 'usuario-1',
      salvarComoFaq: false,
    });

    expect(resultado.solicitacao.status).toBe('respondida');
    expect(resultado.solicitacao.respostaTexto).toBe('Sim, aos sabados das 8h as 12h.');
    expect(resultado.solicitacao.respondidoPorUsuarioId).toBe('usuario-1');
    expect(resultado.solicitacao.respondidoEm).toBeInstanceOf(Date);
    expect(resultado.faqEntryCriada).toBe(false);
    expect(criarFaqEntry.criadas).toHaveLength(0);
  });

  it('cria uma FaqEntry com a pergunta original e a resposta quando salvarComoFaq=true', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({
        id: 'solicitacao-1',
        mensagemCliente: 'Voces atendem aos sabados?',
      }),
    );
    const criarFaqEntry = new FakeCriarFaqEntry();

    const useCase = new ResponderSolicitacaoAtendimentoUseCase({
      solicitacaoAtendimentoRepository,
      criarFaqEntry,
    });

    const resultado = await useCase.execute({
      solicitacaoId: 'solicitacao-1',
      respostaTexto: 'Sim, aos sabados das 8h as 12h.',
      respondidoPorUsuarioId: 'usuario-1',
      salvarComoFaq: true,
    });

    expect(resultado.faqEntryCriada).toBe(true);
    expect(criarFaqEntry.criadas).toEqual([
      { pergunta: 'Voces atendem aos sabados?', resposta: 'Sim, aos sabados das 8h as 12h.' },
    ]);
  });

  it('nao falha e nao cria FaqEntry quando salvarComoFaq=true mas criarFaqEntry nao foi injetado', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(criarSolicitacaoAtendimentoFake({ id: 'solicitacao-1' }));

    const useCase = new ResponderSolicitacaoAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    const resultado = await useCase.execute({
      solicitacaoId: 'solicitacao-1',
      respostaTexto: 'Resposta qualquer',
      respondidoPorUsuarioId: 'usuario-1',
      salvarComoFaq: true,
    });

    expect(resultado.solicitacao.status).toBe('respondida');
    expect(resultado.faqEntryCriada).toBe(false);
  });

  it('lanca NotFoundError quando a solicitacao nao existe', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    const useCase = new ResponderSolicitacaoAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    await expect(
      useCase.execute({
        solicitacaoId: 'inexistente',
        respostaTexto: 'Resposta',
        respondidoPorUsuarioId: 'usuario-1',
        salvarComoFaq: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanca ConflictError quando a solicitacao ja foi respondida', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({ id: 'solicitacao-1', status: 'respondida' }),
    );
    const useCase = new ResponderSolicitacaoAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    await expect(
      useCase.execute({
        solicitacaoId: 'solicitacao-1',
        respostaTexto: 'Resposta',
        respondidoPorUsuarioId: 'usuario-1',
        salvarComoFaq: false,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
