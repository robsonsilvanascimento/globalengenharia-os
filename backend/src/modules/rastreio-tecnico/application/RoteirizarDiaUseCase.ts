import type { OrdemAgendada, OrdemAgendadaRepository } from '../domain/OrdemAgendadaRepository';
import type { RastreioTecnicoRepository } from '../domain/RastreioTecnicoRepository';
import { roteirizar, type Coordenada } from '../domain/geo';

export interface ParadaRoteirizada {
  ordemServicoId: string;
  numero: string;
  clienteNome: string;
  enderecoAtendimento: string | null;
  latitude: number | null;
  longitude: number | null;
  dataAgendada: Date | null;
  status: string;
  ordem: number;
  distanciaKm: number | null;
}

export interface ResultadoRoteirizacao {
  paradas: ParadaRoteirizada[];
  distanciaTotalKm: number;
  pontoPartida: Coordenada | null;
}

/** Limites [inicio, fim) do dia (hora local do servidor) da data informada. */
function limitesDoDia(dia: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0, 0);
  const fim = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1, 0, 0, 0, 0);
  return { inicio, fim };
}

/**
 * Monta a rota do dia de um tecnico: pega as OS agendadas e as ordena por
 * vizinho-mais-proximo, partindo da ultima localizacao conhecida do tecnico
 * (se houver). OS sem coordenada ficam ao fim (nao roteirizaveis).
 */
export class RoteirizarDiaUseCase {
  constructor(
    private readonly deps: {
      ordemAgendadaRepository: OrdemAgendadaRepository;
      rastreioRepository: RastreioTecnicoRepository;
    },
  ) {}

  async execute(input: { tecnicoId: string; dia: Date }): Promise<ResultadoRoteirizacao> {
    const { inicio, fim } = limitesDoDia(input.dia);
    const ordens = await this.deps.ordemAgendadaRepository.listarDoDia(input.tecnicoId, inicio, fim);
    const partida = await this.deps.rastreioRepository.ultimaLocalizacaoDoTecnico(input.tecnicoId);

    const { ordenadas, distanciaTotalKm } = roteirizar<OrdemAgendada>(partida, ordens);

    return {
      distanciaTotalKm,
      pontoPartida: partida,
      paradas: ordenadas.map(({ parada, distanciaKm, ordem }) => ({
        ordemServicoId: parada.id,
        numero: parada.numero,
        clienteNome: parada.clienteNome,
        enderecoAtendimento: parada.enderecoAtendimento,
        latitude: parada.latitude,
        longitude: parada.longitude,
        dataAgendada: parada.dataAgendada,
        status: parada.status,
        ordem,
        distanciaKm,
      })),
    };
  }
}
