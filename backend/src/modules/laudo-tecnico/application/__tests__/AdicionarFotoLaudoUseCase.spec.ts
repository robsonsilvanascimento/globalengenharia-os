import { describe, expect, it, beforeEach } from 'vitest';
import { AdicionarFotoLaudoUseCase } from '../AdicionarFotoLaudoUseCase';
import type { Laudo } from '../../domain/Laudo';
import type { LaudoFoto } from '../../domain/LaudoFoto';
import type { CriarLaudoFotoDados, LaudoFotoRepository } from '../../domain/LaudoFotoRepository';
import type { AtualizarLaudoDados, CriarLaudoDados, LaudoRepository } from '../../domain/LaudoRepository';
import type {
  ArmazenamentoArquivoService,
  ResultadoSalvarArquivo,
} from '../../../../shared/infra/storage/ArmazenamentoArquivoService';

class FakeLaudoRepo implements LaudoRepository {
  constructor(private readonly existe: boolean) {}
  async criar(_d: CriarLaudoDados): Promise<Laudo> {
    throw new Error('nao usado');
  }
  async atualizar(_id: string, _d: AtualizarLaudoDados): Promise<Laudo> {
    throw new Error('nao usado');
  }
  async buscarPorId(id: string): Promise<Laudo | null> {
    if (!this.existe) return null;
    return { id, numero: 'LT-2026-0001' } as Laudo;
  }
  async listarPorOrdemServico(): Promise<Laudo[]> {
    return [];
  }
  async contarNoAno(): Promise<number> {
    return 0;
  }
}

class FakeFotoRepo implements LaudoFotoRepository {
  public fotos: LaudoFoto[] = [];
  private seq = 0;
  async criar(dados: CriarLaudoFotoDados): Promise<LaudoFoto> {
    const foto: LaudoFoto = {
      id: `foto-${(this.seq += 1)}`,
      laudoId: dados.laudoId,
      chaveArquivo: dados.chaveArquivo,
      mimeType: dados.mimeType,
      legenda: dados.legenda ?? null,
      ordem: dados.ordem,
      criadoEm: new Date(),
    };
    this.fotos.push(foto);
    return foto;
  }
  async listarPorLaudo(laudoId: string): Promise<LaudoFoto[]> {
    return this.fotos.filter((f) => f.laudoId === laudoId);
  }
  async buscarPorId(id: string): Promise<LaudoFoto | null> {
    return this.fotos.find((f) => f.id === id) ?? null;
  }
  async maiorOrdem(laudoId: string): Promise<number> {
    return this.fotos.filter((f) => f.laudoId === laudoId).reduce((m, f) => Math.max(m, f.ordem), 0);
  }
  async atualizarLegenda(id: string, legenda: string | null): Promise<LaudoFoto> {
    const foto = this.fotos.find((f) => f.id === id)!;
    foto.legenda = legenda;
    return foto;
  }
  async remover(id: string): Promise<void> {
    this.fotos = this.fotos.filter((f) => f.id !== id);
  }
}

class FakeStorage implements ArmazenamentoArquivoService {
  public salvos: Array<{ buffer: Buffer; nome: string; subpasta?: string }> = [];
  async salvar(buffer: Buffer, nomeArquivo: string, subpasta?: string): Promise<ResultadoSalvarArquivo> {
    this.salvos.push({ buffer, nome: nomeArquivo, subpasta });
    return { chave: `chave-${this.salvos.length}` };
  }
  async lerArquivo(): Promise<Buffer> {
    return Buffer.from('x');
  }
  async remover(): Promise<void> {}
}

const base64Png = 'data:image/png;base64,aGVsbG8='; // "hello"

describe('AdicionarFotoLaudoUseCase', () => {
  let fotoRepo: FakeFotoRepo;
  let storage: FakeStorage;

  beforeEach(() => {
    fotoRepo = new FakeFotoRepo();
    storage = new FakeStorage();
  });

  function montar(existeLaudo = true): AdicionarFotoLaudoUseCase {
    return new AdicionarFotoLaudoUseCase({
      laudoRepository: new FakeLaudoRepo(existeLaudo),
      laudoFotoRepository: fotoRepo,
      armazenamentoArquivoService: storage,
    });
  }

  it('salva a imagem no storage e cria a foto com ordem sequencial', async () => {
    const useCase = montar();
    const a = await useCase.execute({ laudoId: 'laudo-1', base64: base64Png, mimeType: 'image/png', legenda: ' Frente ' });
    const b = await useCase.execute({ laudoId: 'laudo-1', base64: base64Png, mimeType: 'image/png' });
    expect(a.ordem).toBe(1);
    expect(b.ordem).toBe(2);
    expect(a.legenda).toBe('Frente');
    expect(storage.salvos).toHaveLength(2);
    expect(storage.salvos[0]?.subpasta).toBe('laudos/laudo-1');
  });

  it('rejeita formato de imagem nao suportado', async () => {
    await expect(
      montar().execute({ laudoId: 'laudo-1', base64: base64Png, mimeType: 'application/pdf' }),
    ).rejects.toThrow();
  });

  it('rejeita quando o laudo nao existe', async () => {
    await expect(
      montar(false).execute({ laudoId: 'x', base64: base64Png, mimeType: 'image/png' }),
    ).rejects.toThrow();
  });

  it('rejeita imagem vazia', async () => {
    await expect(
      montar().execute({ laudoId: 'laudo-1', base64: '', mimeType: 'image/png' }),
    ).rejects.toThrow();
  });
});
