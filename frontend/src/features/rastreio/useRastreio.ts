import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';

export type TipoRastreio = 'a_caminho' | 'chegada';

export interface EventoRastreio {
  id: string;
  ordem_servico_id: string;
  tecnico_id: string;
  tipo: TipoRastreio;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
}

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface ParadaRota {
  ordem: number;
  ordem_servico_id: string;
  numero: string;
  cliente_nome: string;
  endereco_atendimento: string | null;
  latitude: number | null;
  longitude: number | null;
  data_agendada: string | null;
  status: string;
  distancia_km: number | null;
}

export interface Rota {
  distancia_total_km: number;
  ponto_partida: Coordenada | null;
  paradas: ParadaRota[];
}

export function useRastreioOS(osId: string) {
  return useQuery({
    queryKey: ['rastreio', osId],
    queryFn: () => httpClient.get<EventoRastreio[]>(`/ordens-servico/${osId}/rastreio`),
  });
}

export function useRegistrarACaminho(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coord: Partial<Coordenada>) => httpClient.post<EventoRastreio>(`/ordens-servico/${osId}/a-caminho`, coord),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rastreio', osId] }),
  });
}

export function useCheckin(osId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coord: Coordenada) => httpClient.post<EventoRastreio>(`/ordens-servico/${osId}/checkin`, coord),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rastreio', osId] }),
  });
}

export function useRota(data: string) {
  return useQuery({
    queryKey: ['rota', data],
    queryFn: () => httpClient.get<Rota>('/rota', { data: data ? new Date(`${data}T12:00:00`).toISOString() : undefined }),
  });
}

/** Captura a posicao atual do navegador. Resolve null se indisponivel/negada. */
export function obterLocalizacao(): Promise<Coordenada | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}
