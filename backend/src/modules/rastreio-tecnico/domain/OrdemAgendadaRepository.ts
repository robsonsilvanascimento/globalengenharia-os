/** Visao enxuta de uma OS agendada, usada pela roteirizacao do dia. */
export interface OrdemAgendada {
  id: string;
  numero: string;
  clienteNome: string;
  enderecoAtendimento: string | null;
  latitude: number | null;
  longitude: number | null;
  dataAgendada: Date | null;
  status: string;
}

export interface OrdemAgendadaRepository {
  /** OS de um tecnico agendadas para o dia informado (nao canceladas). */
  listarDoDia(tecnicoId: string, inicioDoDia: Date, fimDoDia: Date): Promise<OrdemAgendada[]>;
  /** Define as coordenadas da OS (usado no check-in quando ainda nao ha coords). */
  definirCoordenadas(ordemServicoId: string, latitude: number, longitude: number): Promise<void>;
}
