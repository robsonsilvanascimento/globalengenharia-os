import type { ArmazenamentoArquivoService } from '../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { MidiaOrdemServico } from '../domain/MidiaOrdemServico';
import type { MidiaOrdemServicoRepository } from '../domain/MidiaOrdemServicoRepository';
import { MidiaNaoEncontradaError } from '../domain/errors/MidiaNaoEncontradaError';

export interface ObterArquivoMidiaResultado {
  midia: MidiaOrdemServico;
  conteudo: Buffer;
}

export interface ObterArquivoMidiaDeps {
  midiaOrdemServicoRepository: MidiaOrdemServicoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

/**
 * Busca o registro da midia e le o conteudo binario do arquivo fisico
 * correspondente.
 * @throws {MidiaNaoEncontradaError} se o registro nao existir.
 */
export class ObterArquivoMidiaUseCase {
  constructor(private readonly deps: ObterArquivoMidiaDeps) {}

  async execute(id: string): Promise<ObterArquivoMidiaResultado> {
    const { midiaOrdemServicoRepository, armazenamentoArquivoService } = this.deps;

    const midia = await midiaOrdemServicoRepository.findById(id);
    if (!midia) {
      throw new MidiaNaoEncontradaError(id);
    }

    const conteudo = await armazenamentoArquivoService.lerArquivo(midia.caminhoArmazenamento);

    return { midia, conteudo };
  }
}
