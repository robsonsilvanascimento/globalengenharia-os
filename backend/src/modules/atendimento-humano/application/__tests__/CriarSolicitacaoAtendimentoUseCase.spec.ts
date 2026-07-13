import { describe, expect, it } from 'vitest';
import { CriarSolicitacaoAtendimentoUseCase } from '../CriarSolicitacaoAtendimentoUseCase';
import { FakeSolicitacaoAtendimentoRepository } from './fakes';

describe('CriarSolicitacaoAtendimentoUseCase', () => {
  it('cria uma solicitacao pendente com os dados da mensagem do cliente', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    const useCase = new CriarSolicitacaoAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    const solicitacao = await useCase.execute({
      clienteId: 'cliente-1',
      conversaId: 'conversa-1',
      mensagemCliente: 'Voces atendem aos sabados?',
    });

    expect(solicitacao.status).toBe('pendente');
    expect(solicitacao.clienteId).toBe('cliente-1');
    expect(solicitacao.conversaId).toBe('conversa-1');
    expect(solicitacao.mensagemCliente).toBe('Voces atendem aos sabados?');
    expect(solicitacaoAtendimentoRepository.solicitacoes).toHaveLength(1);
  });

  it('permite criar sem conversaId (mensagem avulsa)', async () => {
    const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
    const useCase = new CriarSolicitacaoAtendimentoUseCase({ solicitacaoAtendimentoRepository });

    const solicitacao = await useCase.execute({
      clienteId: 'cliente-1',
      mensagemCliente: 'Preciso de ajuda',
    });

    expect(solicitacao.conversaId).toBeUndefined();
  });
});
