import type { SolicitacaoAtendimento, StatusSolicitacaoAtendimento } from './SolicitacaoAtendimento';

/** Dados necessarios para criar uma SolicitacaoAtendimento. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarSolicitacaoAtendimentoDados {
  clienteId: string;
  conversaId?: string;
  mensagemCliente: string;
}

/** Dados para marcar uma SolicitacaoAtendimento como respondida. */
export interface MarcarComoRespondidaDados {
  respostaTexto: string;
  respondidoPorUsuarioId: string;
  salvarComoFaq: boolean;
}

/**
 * Contrato de persistencia para SolicitacaoAtendimento. Nenhum detalhe de
 * Prisma/SQL vaza aqui — a implementacao concreta (repositorio Prisma) fica
 * em infrastructure/.
 */
export interface SolicitacaoAtendimentoRepository {
  create(dados: CriarSolicitacaoAtendimentoDados): Promise<SolicitacaoAtendimento>;
  /** Lista solicitacoes. Quando `status` for informado, filtra por ele; caso contrario, retorna todas. */
  list(status?: StatusSolicitacaoAtendimento): Promise<SolicitacaoAtendimento[]>;
  findById(id: string): Promise<SolicitacaoAtendimento | null>;
  marcarComoRespondida(
    id: string,
    dados: MarcarComoRespondidaDados,
  ): Promise<SolicitacaoAtendimento>;
}
