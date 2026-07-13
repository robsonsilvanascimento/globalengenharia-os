export const OS_STATUS_ALTERADO_EVENT = 'os.status.alterado';

/** Evento de dominio publicado sempre que o status de uma Ordem de Servico muda. */
export interface OSStatusAlterado {
  ordemServicoId: string;
  statusAnterior: string;
  statusNovo: string;
  clienteId: string;
  alteradoPor: string;
  alteradoPorBot: boolean;
  timestamp: Date;
}
