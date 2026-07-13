export const OS_REAGENDADA_EVENT = 'OSReagendada';

/** Evento de dominio publicado quando a data agendada de uma OS e alterada. */
export interface OSReagendada {
  ordemServicoId: string;
  tecnicoId: string;
  dataAgendada: Date;
  timestamp: Date;
}
