import { BadRequestError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { ArmazenamentoArquivoService } from '../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { LaudoFoto } from '../domain/LaudoFoto';
import type { LaudoFotoRepository } from '../domain/LaudoFotoRepository';
import type { LaudoRepository } from '../domain/LaudoRepository';

const MIMES_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Limite do binario decodificado (6 MB) — o cliente ja reduz antes de enviar. */
const TAMANHO_MAXIMO_BYTES = 6 * 1024 * 1024;

export interface AdicionarFotoLaudoInput {
  laudoId: string;
  base64: string;
  mimeType: string;
  legenda?: string | null;
}

/** Remove o prefixo data-URI ("data:image/...;base64,") se presente. */
function extrairBase64(base64: string): string {
  const virgula = base64.indexOf(',');
  return base64.startsWith('data:') && virgula >= 0 ? base64.slice(virgula + 1) : base64;
}

export class AdicionarFotoLaudoUseCase {
  constructor(
    private readonly deps: {
      laudoRepository: LaudoRepository;
      laudoFotoRepository: LaudoFotoRepository;
      armazenamentoArquivoService: ArmazenamentoArquivoService;
    },
  ) {}

  async execute(input: AdicionarFotoLaudoInput): Promise<LaudoFoto> {
    const { laudoRepository, laudoFotoRepository, armazenamentoArquivoService } = this.deps;

    const extensao = MIMES_PERMITIDOS[input.mimeType.toLowerCase()];
    if (!extensao) throw new BadRequestError('Formato de imagem nao suportado (use JPEG, PNG ou WebP)');

    const laudo = await laudoRepository.buscarPorId(input.laudoId);
    if (!laudo) throw new NotFoundError('Laudo nao encontrado');

    const conteudo = Buffer.from(extrairBase64(input.base64), 'base64');
    if (conteudo.length === 0) throw new BadRequestError('Imagem vazia ou invalida');
    if (conteudo.length > TAMANHO_MAXIMO_BYTES) throw new BadRequestError('Imagem muito grande (limite de 6 MB)');

    const { chave } = await armazenamentoArquivoService.salvar(
      conteudo,
      `foto.${extensao}`,
      `laudos/${input.laudoId}`,
    );

    const ordem = (await laudoFotoRepository.maiorOrdem(input.laudoId)) + 1;
    return laudoFotoRepository.criar({
      laudoId: input.laudoId,
      chaveArquivo: chave,
      mimeType: input.mimeType.toLowerCase(),
      legenda: input.legenda?.trim() || null,
      ordem,
    });
  }
}
