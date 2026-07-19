export interface Coordenada {
  latitude: number;
  longitude: number;
}

const RAIO_TERRA_KM = 6371;

function grausParaRad(graus: number): number {
  return (graus * Math.PI) / 180;
}

/** Distancia em km entre duas coordenadas pela formula de Haversine. */
export function haversineKm(a: Coordenada, b: Coordenada): number {
  const dLat = grausParaRad(b.latitude - a.latitude);
  const dLon = grausParaRad(b.longitude - a.longitude);
  const lat1 = grausParaRad(a.latitude);
  const lat2 = grausParaRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coordenada valida do Brasil/mundo: numeros finitos dentro dos limites. */
export function coordenadaValida(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export interface ParadaRota {
  latitude: number | null;
  longitude: number | null;
}

export interface ParadaOrdenada<T> {
  parada: T;
  distanciaKm: number | null;
  ordem: number;
}

export interface ResultadoRota<T> {
  ordenadas: ParadaOrdenada<T>[];
  distanciaTotalKm: number;
}

/**
 * Ordena as paradas por vizinho-mais-proximo (nearest-neighbor) a partir de um
 * ponto inicial. Paradas sem coordenada nao entram na rota geografica e sao
 * jogadas para o fim (distanciaKm = null). Se `inicio` for nulo, comeca pela
 * primeira parada com coordenada. Heuristica simples e deterministica,
 * adequada ao volume real (poucas OS por dia).
 */
export function roteirizar<T extends ParadaRota>(inicio: Coordenada | null, paradas: T[]): ResultadoRota<T> {
  const comCoord = paradas.filter((p) => coordenadaValida(p.latitude, p.longitude));
  const semCoord = paradas.filter((p) => !coordenadaValida(p.latitude, p.longitude));

  const restantes = [...comCoord];
  const ordenadas: ParadaOrdenada<T>[] = [];
  let atual: Coordenada | null = inicio;
  let total = 0;
  let ordem = 0;

  while (restantes.length > 0) {
    let indiceMaisProximo = 0;
    let melhorDistancia = Number.POSITIVE_INFINITY;

    for (let i = 0; i < restantes.length; i += 1) {
      const p = restantes[i]!;
      const coord: Coordenada = { latitude: p.latitude as number, longitude: p.longitude as number };
      const distancia = atual ? haversineKm(atual, coord) : 0;
      if (distancia < melhorDistancia) {
        melhorDistancia = distancia;
        indiceMaisProximo = i;
      }
    }

    const escolhida = restantes.splice(indiceMaisProximo, 1)[0]!;
    const distanciaKm = atual ? melhorDistancia : null;
    if (distanciaKm !== null) total += distanciaKm;
    ordenadas.push({ parada: escolhida, distanciaKm, ordem: (ordem += 1) });
    atual = { latitude: escolhida.latitude as number, longitude: escolhida.longitude as number };
  }

  for (const p of semCoord) {
    ordenadas.push({ parada: p, distanciaKm: null, ordem: (ordem += 1) });
  }

  return { ordenadas, distanciaTotalKm: Math.round(total * 10) / 10 };
}
