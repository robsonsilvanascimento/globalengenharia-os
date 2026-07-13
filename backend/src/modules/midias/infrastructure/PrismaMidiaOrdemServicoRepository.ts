import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { MidiaOrdemServico } from '../domain/MidiaOrdemServico';
import type {
  CriarMidiaOrdemServicoDados,
  MidiaOrdemServicoRepository,
} from '../domain/MidiaOrdemServicoRepository';

/** Implementacao de MidiaOrdemServicoRepository sobre o Prisma Client. */
export class PrismaMidiaOrdemServicoRepository implements MidiaOrdemServicoRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarMidiaOrdemServicoDados): Promise<MidiaOrdemServico> {
    const midia = await this.client.midiaOrdemServico.create({
      data: {
        ordemServicoId: dados.ordemServicoId,
        clienteId: dados.clienteId,
        tipo: dados.tipo,
        caminhoArmazenamento: dados.caminhoArmazenamento,
        mimeType: dados.mimeType,
        tamanhoBytes: dados.tamanhoBytes,
        whatsappMediaId: dados.whatsappMediaId,
      },
    });

    return this.paraDominio(midia);
  }

  async findById(id: string): Promise<MidiaOrdemServico | null> {
    const midia = await this.client.midiaOrdemServico.findUnique({ where: { id } });
    return midia ? this.paraDominio(midia) : null;
  }

  async listByOrdemServicoId(ordemServicoId: string): Promise<MidiaOrdemServico[]> {
    const midias = await this.client.midiaOrdemServico.findMany({
      where: { ordemServicoId },
      orderBy: { criadoEm: 'asc' },
    });

    return midias.map((midia) => this.paraDominio(midia));
  }

  async delete(id: string): Promise<void> {
    await this.client.midiaOrdemServico.delete({ where: { id } });
  }

  /** Converte o registro do Prisma (campos opcionais em null) para a entidade de dominio (campos opcionais undefined). */
  private paraDominio(midia: {
    id: string;
    ordemServicoId: string | null;
    clienteId: string;
    tipo: string;
    caminhoArmazenamento: string;
    mimeType: string;
    tamanhoBytes: number;
    whatsappMediaId: string | null;
    criadoEm: Date;
  }): MidiaOrdemServico {
    return {
      id: midia.id,
      ordemServicoId: midia.ordemServicoId ?? undefined,
      clienteId: midia.clienteId,
      tipo: midia.tipo as MidiaOrdemServico['tipo'],
      caminhoArmazenamento: midia.caminhoArmazenamento,
      mimeType: midia.mimeType,
      tamanhoBytes: midia.tamanhoBytes,
      whatsappMediaId: midia.whatsappMediaId ?? undefined,
      criadoEm: midia.criadoEm,
    };
  }
}
