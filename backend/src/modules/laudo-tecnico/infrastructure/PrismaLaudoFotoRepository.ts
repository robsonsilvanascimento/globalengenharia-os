import type { LaudoFoto as LaudoFotoPrisma, PrismaClient } from '@prisma/client';
import type { LaudoFoto } from '../domain/LaudoFoto';
import type { CriarLaudoFotoDados, LaudoFotoRepository } from '../domain/LaudoFotoRepository';

function paraEntidade(r: LaudoFotoPrisma): LaudoFoto {
  return {
    id: r.id,
    laudoId: r.laudoId,
    chaveArquivo: r.chaveArquivo,
    mimeType: r.mimeType,
    legenda: r.legenda,
    ordem: r.ordem,
    criadoEm: r.criadoEm,
  };
}

export class PrismaLaudoFotoRepository implements LaudoFotoRepository {
  constructor(private readonly client: PrismaClient) {}

  async criar(dados: CriarLaudoFotoDados): Promise<LaudoFoto> {
    const registro = await this.client.laudoFoto.create({
      data: {
        laudoId: dados.laudoId,
        chaveArquivo: dados.chaveArquivo,
        mimeType: dados.mimeType,
        legenda: dados.legenda ?? null,
        ordem: dados.ordem,
      },
    });
    return paraEntidade(registro);
  }

  async listarPorLaudo(laudoId: string): Promise<LaudoFoto[]> {
    const registros = await this.client.laudoFoto.findMany({
      where: { laudoId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
    return registros.map(paraEntidade);
  }

  async buscarPorId(id: string): Promise<LaudoFoto | null> {
    const registro = await this.client.laudoFoto.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async maiorOrdem(laudoId: string): Promise<number> {
    const resultado = await this.client.laudoFoto.aggregate({
      where: { laudoId },
      _max: { ordem: true },
    });
    return resultado._max.ordem ?? 0;
  }

  async atualizarLegenda(id: string, legenda: string | null): Promise<LaudoFoto> {
    const registro = await this.client.laudoFoto.update({
      where: { id },
      data: { legenda },
    });
    return paraEntidade(registro);
  }

  async remover(id: string): Promise<void> {
    await this.client.laudoFoto.delete({ where: { id } });
  }
}
