import type { PrismaClient } from '@prisma/client';
import type { PendenciaOS, FotoPendencia, RegistrarPendenciaInput } from '../domain/PendenciaOS';
import type { PendenciaOSRepository } from '../domain/PendenciaOSRepository';
import { randomUUID } from 'node:crypto';

type PrismaFotoPendencia = {
  id: string;
  pendenciaId: string;
  mimeType: string;
  base64: string;
  criadoEm: Date;
};

type PrismaPendenciaOS = {
  id: string;
  ordemServicoId: string;
  observacao: string;
  criadoPorId: string | null;
  criadoEm: Date;
  fotos: PrismaFotoPendencia[];
};

export class PrismaPendenciaOSRepository implements PendenciaOSRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: RegistrarPendenciaInput): Promise<PendenciaOS> {
    const id = randomUUID();

    const row = await this.client.pendenciaOS.create({
      data: {
        id,
        ordemServicoId: input.ordemServicoId,
        observacao: input.observacao,
        criadoPorId: input.criadoPorId ?? null,
        fotos: {
          createMany: {
            data: input.fotos.map((f) => ({
              id: randomUUID(),
              mimeType: f.mimeType,
              base64: f.base64,
            })),
          },
        },
      },
      include: { fotos: true },
    });

    return this.toEntity(row);
  }

  async findByOrdemServico(ordemServicoId: string): Promise<PendenciaOS[]> {
    const rows = await this.client.pendenciaOS.findMany({
      where: { ordemServicoId },
      include: { fotos: true },
      orderBy: { criadoEm: 'asc' },
    });

    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: PrismaPendenciaOS): PendenciaOS {
    return {
      id: row.id,
      ordemServicoId: row.ordemServicoId,
      observacao: row.observacao,
      criadoPorId: row.criadoPorId,
      criadoEm: row.criadoEm,
      fotos: row.fotos.map((f) => this.toFotoEntity(f)),
    };
  }

  private toFotoEntity(row: PrismaFotoPendencia): FotoPendencia {
    return {
      id: row.id,
      pendenciaId: row.pendenciaId,
      mimeType: row.mimeType,
      base64: row.base64,
      criadoEm: row.criadoEm,
    };
  }
}
