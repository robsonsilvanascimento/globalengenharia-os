import { describe, expect, it } from 'vitest';
import { ListarSolicitacoesAtendimentoUseCase } from '../ListarSolicitacoesAtendimentoUseCase';
import { FakeSolicitacaoAtendimentoRepository, criarSolicitacaoAtendimentoFake } from './fakes';

describe('ListarSolicitacoesAtendimentoUseCase', () => {
  it('lista apenas pendentes por padrao quando nenhum status e informado', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({ id: 'solicitacao-pendente', status: 'pendente' }),
    );
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({ id: 'solicitacao-respondida', status: 'respondida' }),
    );

    const useCase = new ListarSolicitacoesAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    const resultado = await useCase.execute();

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('solicitacao-pendente');
  });

  it('lista pelo status informado explicitamente', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({ id: 'solicitacao-pendente', status: 'pendente' }),
    );
    solicitacaoAtendimentoRepository.seed(
      criarSolicitacaoAtendimentoFake({ id: 'solicitacao-respondida', status: 'respondida' }),
    );

    const useCase = new ListarSolicitacoesAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    const resultado = await useCase.execute('respondida');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('solicitacao-respondida');
  });
});
