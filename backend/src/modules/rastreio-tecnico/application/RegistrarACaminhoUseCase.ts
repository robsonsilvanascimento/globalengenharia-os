import { ForbiddenError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { RastreioTecnicoOS } from '../domain/RastreioTecnicoOS';
import type { RastreioTecnicoRepository } from '../domain/RastreioTecnicoRepository';
import { coordenadaValida } from '../domain/geo';
import type { AtorRastreio, BuscarOSParaRastreio, NotificarClienteACaminho } from './ports';

export interface RegistrarACaminhoInput {
  ordemServicoId: string;
  ator: AtorRastreio;
  latitude?: number | null;
  longitude?: number | null;
}

/** O tecnico avisa que esta a caminho: registra o evento e notifica o cliente. */
export class RegistrarACaminhoUseCase {
  constructor(
    private readonly deps: {
      rastreioRepository: RastreioTecnicoRepository;
      buscarOS: BuscarOSParaRastreio;
      notificarCliente: NotificarClienteACaminho;
    },
  ) {}

  async execute(input: RegistrarACaminhoInput): Promise<RastreioTecnicoOS> {
    const os = await this.deps.buscarOS.buscar(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');
    if (input.ator.papel !== 'admin' && os.tecnicoId !== input.ator.id) {
      throw new ForbiddenError('Voce nao esta atribuido a esta ordem de servico');
    }

    // Anti-spam: so avisa o cliente na primeira saida registrada para esta OS.
    // Toques repetidos (ou conta comprometida) nao geram novas mensagens.
    const eventos = await this.deps.rastreioRepository.listarPorOrdemServico(os.id);
    const jaAvisou = eventos.some((e) => e.tipo === 'a_caminho');

    // Notifica ANTES de gravar o evento: se o enqueue falhar (fila indisponivel)
    // o evento nao e persistido, entao o retry do tecnico volta a tentar
    // notificar. Gravar antes suprimiria o aviso para sempre numa falha
    // transitoria (o proximo toque veria "ja avisou").
    if (!jaAvisou) {
      await this.deps.notificarCliente({ ordemServicoId: os.id, clienteId: os.clienteId });
    }

    const temCoord = coordenadaValida(input.latitude, input.longitude);
    const evento = await this.deps.rastreioRepository.criar({
      ordemServicoId: os.id,
      tecnicoId: input.ator.id,
      tipo: 'a_caminho',
      latitude: temCoord ? (input.latitude as number) : null,
      longitude: temCoord ? (input.longitude as number) : null,
    });

    return evento;
  }
}
