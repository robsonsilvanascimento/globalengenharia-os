import type { SolicitacaoAtendimento, StatusSolicitacaoAtendimento } from '../../domain/SolicitacaoAtendimento';
import type {
  CriarSolicitacaoAtendimentoDados,
  MarcarComoRespondidaDados,
  SolicitacaoAtendimentoRepository,
} from '../../domain/SolicitacaoAtendimentoRepository';
import type { CriarFaqEntryPort } from '../ResponderSolicitacaoAtendimentoUseCase';

/** Fake em memoria de SolicitacaoAtendimentoRepository, usado nos testes (sem Postgres real). */
export class FakeSolicitacaoAtendimentoRepository implements SolicitacaoAtendimentoRepository {
  public solicitacoes: SolicitacaoAtendimento[] = [];
  private seq = 0;

  seed(solicitacao: SolicitacaoAtendimento): void {
    this.solicitacoes.push(solicitacao);
  }

  async create(dados: CriarSolicitacaoAtendimentoDados): Promise<SolicitacaoAtendimento> {
    this.seq += 1;
    const solicitacao: SolicitacaoAtendimento = {
      id: `solicitacao-${this.seq}`,
      clienteId: dados.clienteId,
      conversaId: dados.conversaId,
      mensagemCliente: dados.mensagemCliente,
      status: 'pendente',
      salvarComoFaq: false,
      criadoEm: new Date(),
    };
    this.solicitacoes.push(solicitacao);
    return solicitacao;
  }

  async list(status?: StatusSolicitacaoAtendimento): Promise<SolicitacaoAtendimento[]> {
    return status ? this.solicitacoes.filter((s) => s.status === status) : [...this.solicitacoes];
  }

  async findById(id: string): Promise<SolicitacaoAtendimento | null> {
    return this.solicitacoes.find((s) => s.id === id) ?? null;
  }

  async marcarComoRespondida(
    id: string,
    dados: MarcarComoRespondidaDados,
  ): Promise<SolicitacaoAtendimento> {
    const solicitacao = this.solicitacoes.find((s) => s.id === id);
    if (!solicitacao) {
      throw new Error(`SolicitacaoAtendimento ${id} nao encontrada (fake)`);
    }

    solicitacao.status = 'respondida';
    solicitacao.respostaTexto = dados.respostaTexto;
    solicitacao.respondidoPorUsuarioId = dados.respondidoPorUsuarioId;
    solicitacao.salvarComoFaq = dados.salvarComoFaq;
    solicitacao.respondidoEm = new Date();

    return solicitacao;
  }
}

/** Fake de FaqEntryRepository (estruturalmente compativel com CriarFaqEntryPort). */
export class FakeCriarFaqEntry implements CriarFaqEntryPort {
  public criadas: Array<{ pergunta: string; resposta: string }> = [];

  async create(dados: { pergunta: string; resposta: string }): Promise<unknown> {
    this.criadas.push(dados);
    return { id: `faq-${this.criadas.length}`, ...dados };
  }
}

export function criarSolicitacaoAtendimentoFake(
  overrides: Partial<SolicitacaoAtendimento> = {},
): SolicitacaoAtendimento {
  return {
    id: 'solicitacao-1',
    clienteId: 'cliente-1',
    conversaId: undefined,
    mensagemCliente: 'Qual o horario de atendimento?',
    status: 'pendente',
    salvarComoFaq: false,
    criadoEm: new Date(),
    ...overrides,
  };
}
