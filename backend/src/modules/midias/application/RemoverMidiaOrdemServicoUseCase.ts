import type { ArmazenamentoArquivoService } from '../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { MidiaOrdemServicoRepository } from '../domain/MidiaOrdemServicoRepository';
import { MidiaNaoEncontradaError } from '../domain/errors/MidiaNaoEncontradaError';

export interface RemoverMidiaOrdemServicoDeps {
  midiaOrdemServicoRepository: MidiaOrdemServicoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

/**
 * Remove o arquivo fisico da midia (idempotente, via ArmazenamentoArquivoService)
 * e em seguida o registro correspondente.
 * @throws {MidiaNaoEncontradaError} se o registro nao existir.
 */
export class RemoverMidiaOrdemServicoUseCase {
  constructor(private readonly deps: RemoverMidiaOrdemServicoDeps) {}

  async execute(id: string): Promise<void> {
    const { midiaOrdemServicoRepository, armazenamentoArquivoService } = this.deps;

    const midia = await midiaOrdemServicoRepository.findById(id);
    if (!midia) {
      throw new MidiaNaoEncontradaError(id);
    }

    await armazenamentoArquivoService.remover(midia.caminhoArmazenamento);
    await midiaOrdemServicoRepository.delete(midia.id);
  }
}
