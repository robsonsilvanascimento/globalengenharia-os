import type { ContextoConversaWhatsapp, EstadoFluxoConversa } from './FluxoConversa';

/** Entidade de dominio ConversaWhatsapp. Nao carrega nenhum detalhe de persistencia. */
export interface ConversaWhatsapp {
  id: string;
  clienteId: string;
  telefoneWhatsapp: string;
  estadoFluxo: EstadoFluxoConversa;
  contextoDados: ContextoConversaWhatsapp;
  ordemServicoId?: string;
  iniciadaEm: Date;
  atualizadaEm: Date;
}
