export type TipoRastreio = 'a_caminho' | 'chegada';

export interface RastreioTecnicoOS {
  id: string;
  ordemServicoId: string;
  tecnicoId: string;
  tipo: TipoRastreio;
  latitude: number | null;
  longitude: number | null;
  criadoEm: Date;
}
