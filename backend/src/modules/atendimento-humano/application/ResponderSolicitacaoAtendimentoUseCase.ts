import { ConflictError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { SolicitacaoAtendimento } from '../domain/SolicitacaoAtendimento';
import type { SolicitacaoAtendimentoRepository } from '../domain/SolicitacaoAtendimentoRepository';

/**
 * Contrato minimo de persistencia de FAQ exigido por este use case. Espelha
 * (estruturalmente compativel com) `FaqEntryRepository` do modulo `faq`
 * (src/modules/faq/domain/FaqEntryRepository.ts). Mantido como interface
 * local para nao acoplar este modulo ao `faq` — qualquer implementacao
 * (inclusive o `FaqEntryRepository` real) pode ser injetada aqui.
 */
export interface CriarFaqEntryPort {
  create(dados: { pergunta: string; resposta: string }): Promise<unknown>;
}

export interface ResponderSolicitacaoAtendimentoInput {
  solicitacaoId: string;
  respostaTexto: string;
  respondidoPorUsuarioId: string;
  salvarComoFaq: boolean;
}

export interface ResponderSolicitacaoAtendimentoOutput {
  solicitacao: SolicitacaoAtendimento;
  faqEntryCriada: boolean;
}

export interface ResponderSolicitacaoAtendimentoDeps {
  solicitacaoAtendimentoRepository: SolicitacaoAtendimentoRepository;
  /**
   * Dependencia opcional: quando ausente e `salvarComoFaq` for true, a
   * solicitacao ainda e marcada como respondida normalmente, mas nenhuma
   * FaqEntry e criada (silenciosamente ignorado, para nao acoplar
   * rigidamente ao modulo `faq`).
   */
  criarFaqEntry?: CriarFaqEntryPort;
}

/**
 * Marca uma SolicitacaoAtendimento como respondida. Quando `salvarComoFaq`
 * for true, tambem cria uma nova entrada de FAQ (pergunta = mensagem
 * original do cliente, resposta = texto informado pelo atendente).
 *
 * Este use case apenas persiste e prepara os dados; o envio da resposta de
 * volta ao cliente pelo WhatsApp fica a cargo de quem o invoca (rota HTTP /
 * modulo whatsapp), usando os dados retornados em `solicitacao`
 * (clienteId, respostaTexto).
 */
export class ResponderSolicitacaoAtendimentoUseCase {
  constructor(private readonly deps: ResponderSolicitacaoAtendimentoDeps) {}

  async execute(
    input: ResponderSolicitacaoAtendimentoInput,
  ): Promise<ResponderSolicitacaoAtendimentoOutput> {
    const { solicitacaoAtendimentoRepository, criarFaqEntry } = this.deps;

    const solicitacaoExistente = await solicitacaoAtendimentoRepository.findById(
      input.solicitacaoId,
    );

    if (!solicitacaoExistente) {
      throw new NotFoundError('Solicitacao de atendimento nao encontrada');
    }

    if (solicitacaoExistente.status === 'respondida') {
      throw new ConflictError('Solicitacao de atendimento ja foi respondida');
    }

    const solicitacao = await solicitacaoAtendimentoRepository.marcarComoRespondida(
      input.solicitacaoId,
      {
        respostaTexto: input.respostaTexto,
        respondidoPorUsuarioId: input.respondidoPorUsuarioId,
        salvarComoFaq: input.salvarComoFaq,
      },
    );

    let faqEntryCriada = false;
    if (input.salvarComoFaq && criarFaqEntry) {
      await criarFaqEntry.create({
        pergunta: solicitacaoExistente.mensagemCliente,
        resposta: input.respostaTexto,
      });
      faqEntryCriada = true;
    }

    return { solicitacao, faqEntryCriada };
  }
}
