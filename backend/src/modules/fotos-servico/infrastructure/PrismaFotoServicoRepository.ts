import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  AdicionarFotoServicoInput,
  FotoServicoRealizado,
  MomentoFoto,
} from '../domain/FotoServicoRealizado';
import type { FotoServicoRepository } from '../domain/FotoServicoRepository';

type FotoRow = {
  id: string;
  ordemServicoId: string;
  mimeType: string;
  base64: string;
  legenda: string | null;
  momento: string | null;
  enviadoPorId: string | null;
  criadoEm: Date;
  enviadoPor: { nome: string } | null;
};

export class PrismaFotoServicoRepository implements FotoServicoRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: AdicionarFotoServicoInput): Promise<FotoServicoRealizado> {
    const row = await this.client.fotoServicoRealizado.create({
      data: {
        id: randomUUID(),
        ordemServicoId: input.ordemServicoId,
        mimeType: input.mimeType,
        base64: input.base64,
        legenda: input.legenda ?? null,
        momento: input.momento ?? null,
        enviadoPorId: input.enviadoPorId ?? null,
      },
      include: {
        enviadoPor: { select: { nome: true } },
      },
    });

    return this.toEntity(row as FotoRow);
  }

  async findByOrdemServico(ordemServicoId: string): Promise<FotoServicoRealizado[]> {
    const rows = await this.client.fotoServicoRealizado.findMany({
      where: { ordemServicoId },
      include: { enviadoPor: { select: { nome: true } } },
      orderBy: { criadoEm: 'asc' },
    });

    return rows.map((r) => this.toEntity(r as FotoRow));
  }

  private toEntity(row: FotoRow): FotoServicoRealizado {
    return {
      id: row.id,
      ordemServicoId: row.ordemServicoId,
      mimeType: row.mimeType,
      base64: row.base64,
      legenda: row.legenda,
      momento: row.momento === 'antes' || row.momento === 'depois' ? (row.momento as MomentoFoto) : null,
      enviadoPorId: row.enviadoPorId,
      enviadoPorNome: row.enviadoPor?.nome ?? null,
      criadoEm: row.criadoEm,
    };
  }
}
