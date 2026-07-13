import type { ArmazenamentoArquivoService } from '../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { MidiaOrdemServico, TipoMidia } from '../domain/MidiaOrdemServico';
import type { MidiaOrdemServicoRepository } from '../domain/MidiaOrdemServicoRepository';

export interface CriarMidiaOrdemServicoInput {
  ordemServicoId?: string;
  clienteId: string;
  tipo: TipoMidia;
  buffer: Buffer;
  nomeArquivo: string;
  mimeType: string;
  whatsappMediaId?: string;
}

export interface CriarMidiaOrdemServicoDeps {
  midiaOrdemServicoRepository: MidiaOrdemServicoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

/**
 * Persiste fisicamente o arquivo de midia (via ArmazenamentoArquivoService,
 * na subpasta "videos") e cria o registro correspondente. Sera chamado pelo
 * worker do WhatsApp quando um video recebido do cliente for processado
 * (fora do escopo deste modulo).
 */
export class CriarMidiaOrdemServicoUseCase {
  constructor(private readonly deps: CriarMidiaOrdemServicoDeps) {}

  async execute(input: CriarMidiaOrdemServicoInput): Promise<MidiaOrdemServico> {
    const { midiaOrdemServicoRepository, armazenamentoArquivoService } = this.deps;

    const { chave } = await armazenamentoArquivoService.salvar(input.buffer, input.nomeArquivo, 'videos');

    return midiaOrdemServicoRepository.create({
      ordemServicoId: input.ordemServicoId,
      clienteId: input.clienteId,
      tipo: input.tipo,
      caminhoArmazenamento: chave,
      mimeType: input.mimeType,
      tamanhoBytes: input.buffer.length,
      whatsappMediaId: input.whatsappMediaId,
    });
  }
}
