import type { PrismaClient } from '@prisma/client';
import type { DocumentoOS, AdicionarDocumentoOSInput, TipoDocumentoOS } from '../domain/DocumentoOS';
import type { DocumentoOSRepository } from '../domain/DocumentoOSRepository';
import { randomUUID } from 'node:crypto';

export class PrismaDocumentoOSRepository implements DocumentoOSRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: AdicionarDocumentoOSInput): Promise<DocumentoOS> {
    const row = await this.client.documentoOS.create({
      data: {
        id: randomUUID(),
        ordemServicoId: input.ordemServicoId,
        componenteInstaladoId: input.componenteInstaladoId ?? null,
        nome: input.nome,
        tipoDocumento: input.tipoDocumento,
        caminhoArmazenamento: input.caminhoArmazenamento,
        mimeType: input.mimeType,
        tamanhoBytes: input.tamanhoBytes,
        ativo: true,
        carregadoPorUsuarioId: input.carregadoPorUsuarioId ?? null,
      },
    });
    return this.toEntity(row);
  }

  async findById(id: string): Promise<DocumentoOS | null> {
    const row = await this.client.documentoOS.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByOrdemServico(ordemServicoId: string): Promise<DocumentoOS[]> {
    const rows = await this.client.documentoOS.findMany({
      where: { ordemServicoId, ativo: true },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByComponente(componenteInstaladoId: string): Promise<DocumentoOS[]> {
    const rows = await this.client.documentoOS.findMany({
      where: { componenteInstaladoId, ativo: true },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async deactivate(id: string): Promise<void> {
    await this.client.documentoOS.update({ where: { id }, data: { ativo: false } });
  }

  private toEntity(row: {
    id: string;
    ordemServicoId: string;
    componenteInstaladoId: string | null;
    nome: string;
    tipoDocumento: string;
    caminhoArmazenamento: string;
    mimeType: string;
    tamanhoBytes: number;
    ativo: boolean;
    carregadoPorUsuarioId: string | null;
    criadoEm: Date;
  }): DocumentoOS {
    return {
      id: row.id,
      ordemServicoId: row.ordemServicoId,
      componenteInstaladoId: row.componenteInstaladoId,
      nome: row.nome,
      tipoDocumento: row.tipoDocumento as TipoDocumentoOS,
      caminhoArmazenamento: row.caminhoArmazenamento,
      mimeType: row.mimeType,
      tamanhoBytes: row.tamanhoBytes,
      ativo: row.ativo,
      carregadoPorUsuarioId: row.carregadoPorUsuarioId,
      criadoEm: row.criadoEm,
    };
  }
}
