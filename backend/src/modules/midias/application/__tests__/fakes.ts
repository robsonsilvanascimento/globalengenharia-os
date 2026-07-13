import type {
  ArmazenamentoArquivoService,
  ResultadoSalvarArquivo,
} from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import { ArquivoNaoEncontradoError } from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { MidiaOrdemServico } from '../../domain/MidiaOrdemServico';
import type {
  CriarMidiaOrdemServicoDados,
  MidiaOrdemServicoRepository,
} from '../../domain/MidiaOrdemServicoRepository';

/** Repositorio em memoria de MidiaOrdemServico, usado nos testes de use case (sem Postgres real). */
export class FakeMidiaOrdemServicoRepository implements MidiaOrdemServicoRepository {
  public midias: MidiaOrdemServico[] = [];
  private seq = 0;

  seed(midia: MidiaOrdemServico): void {
    this.midias.push(midia);
  }

  async create(dados: CriarMidiaOrdemServicoDados): Promise<MidiaOrdemServico> {
    this.seq += 1;
    const midia: MidiaOrdemServico = {
      id: `midia-${this.seq}`,
      ordemServicoId: dados.ordemServicoId,
      clienteId: dados.clienteId,
      tipo: dados.tipo,
      caminhoArmazenamento: dados.caminhoArmazenamento,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.tamanhoBytes,
      whatsappMediaId: dados.whatsappMediaId,
      criadoEm: new Date(),
    };
    this.midias.push(midia);
    return midia;
  }

  async findById(id: string): Promise<MidiaOrdemServico | null> {
    return this.midias.find((midia) => midia.id === id) ?? null;
  }

  async listByOrdemServicoId(ordemServicoId: string): Promise<MidiaOrdemServico[]> {
    return this.midias.filter((midia) => midia.ordemServicoId === ordemServicoId);
  }

  async delete(id: string): Promise<void> {
    this.midias = this.midias.filter((midia) => midia.id !== id);
  }
}

/** Armazenamento de arquivos em memoria, usado nos testes de use case (sem filesystem real). */
export class FakeArmazenamentoArquivoService implements ArmazenamentoArquivoService {
  public arquivos = new Map<string, Buffer>();
  private seq = 0;

  async salvar(buffer: Buffer, nomeArquivo: string, subpasta = ''): Promise<ResultadoSalvarArquivo> {
    this.seq += 1;
    const chave = subpasta ? `${subpasta}/${this.seq}-${nomeArquivo}` : `${this.seq}-${nomeArquivo}`;
    this.arquivos.set(chave, buffer);
    return { chave };
  }

  async lerArquivo(chave: string): Promise<Buffer> {
    const conteudo = this.arquivos.get(chave);
    if (!conteudo) {
      throw new ArquivoNaoEncontradoError(chave);
    }
    return conteudo;
  }

  async remover(chave: string): Promise<void> {
    this.arquivos.delete(chave);
  }
}

export function criarMidiaFake(overrides: Partial<MidiaOrdemServico> = {}): MidiaOrdemServico {
  return {
    id: 'midia-seed-1',
    ordemServicoId: 'os-1',
    clienteId: 'cliente-1',
    tipo: 'video',
    caminhoArmazenamento: 'videos/seed-video.mp4',
    mimeType: 'video/mp4',
    tamanhoBytes: 1024,
    criadoEm: new Date(),
    ...overrides,
  };
}
