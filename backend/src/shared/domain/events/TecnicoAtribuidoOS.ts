export const TECNICO_ATRIBUIDO_OS_EVENT = 'TecnicoAtribuidoOS';

/** Evento de dominio publicado sempre que um tecnico e atribuido a uma Ordem de Servico. */
export interface TecnicoAtribuidoOS {
  ordemServicoId: string;
  tecnicoId: string;
  ajudanteId?: string;
  clienteId: string;
  timestamp: Date;
}
