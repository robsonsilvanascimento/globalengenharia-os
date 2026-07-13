import type { ConversaWhatsapp } from './ConversaWhatsapp';
import type { ContextoConversaWhatsapp, EstadoFluxoConversa } from './FluxoConversa';

/** Dados necessarios para criar uma ConversaWhatsapp. `id`, `iniciadaEm` e `atualizadaEm` sao gerados pela implementacao. */
export interface CriarConversaWhatsappDados {
  clienteId: string;
  telefoneWhatsapp: string;
  estadoFluxo: EstadoFluxoConversa;
  contextoDados: ContextoConversaWhatsapp;
}

/** Dados parciais aceitos em uma atualizacao de ConversaWhatsapp. */
export interface AtualizarConversaWhatsappDados {
  estadoFluxo?: EstadoFluxoConversa;
  contextoDados?: ContextoConversaWhatsapp;
  ordemServicoId?: string;
}

/**
 * Contrato de persistencia para ConversaWhatsapp. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 *
 * `findByTelefone` retorna a conversa mais recente daquele telefone (nao ha
 * conceito de "conversa ativa" no schema: quando uma conversa atinge o
 * estado terminal `os_criada`, a proxima mensagem do mesmo telefone inicia
 * uma nova conversa).
 */
export interface ConversaWhatsappRepository {
  findByTelefone(telefone: string): Promise<ConversaWhatsapp | null>;
  create(dados: CriarConversaWhatsappDados): Promise<ConversaWhatsapp>;
  update(id: string, dados: AtualizarConversaWhatsappDados): Promise<ConversaWhatsapp>;
}
