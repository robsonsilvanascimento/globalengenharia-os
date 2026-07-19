import type { RastreioTecnicoOS, TipoRastreio } from './RastreioTecnicoOS';

export interface CriarRastreioDados {
  ordemServicoId: string;
  tecnicoId: string;
  tipo: TipoRastreio;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RastreioTecnicoRepository {
  criar(dados: CriarRastreioDados): Promise<RastreioTecnicoOS>;
  listarPorOrdemServico(ordemServicoId: string): Promise<RastreioTecnicoOS[]>;
  /** Ultimo evento com coordenada de um tecnico (ponto de partida da rota). */
  ultimaLocalizacaoDoTecnico(tecnicoId: string): Promise<{ latitude: number; longitude: number } | null>;
}
