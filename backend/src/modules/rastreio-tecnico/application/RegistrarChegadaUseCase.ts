import { BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { RastreioTecnicoOS } from '../domain/RastreioTecnicoOS';
import type { RastreioTecnicoRepository } from '../domain/RastreioTecnicoRepository';
import type { OrdemAgendadaRepository } from '../domain/OrdemAgendadaRepository';
import { coordenadaValida } from '../domain/geo';
import type { AtorRastreio, BuscarOSParaRastreio } from './ports';

export interface RegistrarChegadaInput {
  ordemServicoId: string;
  ator: AtorRastreio;
  latitude: number;
  longitude: number;
}

/**
 * Check-in por GPS na chegada ao local. Exige coordenada valida (comprova o
 * deslocamento) e, se a OS ainda nao tem coordenadas, adota as do check-in
 * para alimentar a roteirizacao futura.
 */
export class RegistrarChegadaUseCase {
  constructor(
    private readonly deps: {
      rastreioRepository: RastreioTecnicoRepository;
      buscarOS: BuscarOSParaRastreio;
      ordemAgendadaRepository: OrdemAgendadaRepository;
    },
  ) {}

  async execute(input: RegistrarChegadaInput): Promise<RastreioTecnicoOS> {
    if (!coordenadaValida(input.latitude, input.longitude)) {
      throw new BadRequestError('Coordenadas de GPS invalidas para o check-in');
    }

    const os = await this.deps.buscarOS.buscar(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');
    if (input.ator.papel !== 'admin' && os.tecnicoId !== input.ator.id) {
      throw new ForbiddenError('Voce nao esta atribuido a esta ordem de servico');
    }

    const evento = await this.deps.rastreioRepository.criar({
      ordemServicoId: os.id,
      tecnicoId: input.ator.id,
      tipo: 'chegada',
      latitude: input.latitude,
      longitude: input.longitude,
    });

    if (!coordenadaValida(os.latitude, os.longitude)) {
      await this.deps.ordemAgendadaRepository.definirCoordenadas(os.id, input.latitude, input.longitude);
    }

    return evento;
  }
}
