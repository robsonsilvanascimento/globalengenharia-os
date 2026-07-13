import type { SolicitacaoAtendimento } from '../domain/SolicitacaoAtendimento';
import type { SolicitacaoAtendimentoRepository } from '../domain/SolicitacaoAtendimentoRepository';

export interface CriarSolicitacaoAtendimentoInput {
  clienteId: string;
  conversaId?: string;
  mensagemCliente: string;
}

export interface CriarSolicitacaoAtendimentoDeps {
  solicitacaoAtendimentoRepository: SolicitacaoAtendimentoRepository;
}

/**
 * Cria uma SolicitacaoAtendimento pendente. Usado pelo bot do WhatsApp
 * (modulo whatsapp) quando ele nao sabe responder a mensagem do cliente e
 * precisa escalar para atendimento humano.
 */
export class CriarSolicitacaoAtendimentoUseCase {
  constructor(private readonly deps: CriarSolicitacaoAtendimentoDeps) {}

  async execute(input: CriarSolicitacaoAtendimentoInput): Promise<SolicitacaoAtendimento> {
    const { solicitacaoAtendimentoRepository } = this.deps;

    return solicitacaoAtendimentoRepository.create({
      clienteId: input.clienteId,
      conversaId: input.conversaId,
      mensagemCliente: input.mensagemCliente,
    });
  }
}
