import type { PrismaClient } from '@prisma/client';
import type { ComponenteInstalado, CriarComponenteInstaladoInput } from '../domain/ComponenteInstalado';
import type { ComponenteInstaladoRepository } from '../domain/ComponenteInstaladoRepository';
import { randomUUID } from 'node:crypto';

export class PrismaComponenteInstaladoRepository implements ComponenteInstaladoRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CriarComponenteInstaladoInput): Promise<ComponenteInstalado> {
    const garantiaExpiraEm =
      input.garantiaMeses != null
        ? (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + input.garantiaMeses!);
            return d;
          })()
        : null;

    const row = await this.client.componenteInstalado.create({
      data: {
        id: randomUUID(),
        ordemServicoId: input.ordemServicoId,
        nome: input.nome,
        fabricante: input.fabricante ?? null,
        modelo: input.modelo ?? null,
        numeroSerie: input.numeroSerie ?? null,
        codigoBarras: input.codigoBarras ?? null,
        garantiaMeses: input.garantiaMeses ?? null,
        garantiaExpiraEm,
        observacoes: input.observacoes ?? null,
        criadoPorUsuarioId: input.criadoPorUsuarioId ?? null,
      },
    });

    return this.toEntity(row);
  }

  async findById(id: string): Promise<ComponenteInstalado | null> {
    const row = await this.client.componenteInstalado.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByOrdemServico(ordemServicoId: string): Promise<ComponenteInstalado[]> {
    const rows = await this.client.componenteInstalado.findMany({
      where: { ordemServicoId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByNumeroSerie(numeroSerie: string): Promise<ComponenteInstalado[]> {
    const rows = await this.client.componenteInstalado.findMany({
      where: { numeroSerie },
      orderBy: { criadoEm: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: {
    id: string;
    ordemServicoId: string;
    nome: string;
    fabricante: string | null;
    modelo: string | null;
    numeroSerie: string | null;
    codigoBarras: string | null;
    garantiaMeses: number | null;
    garantiaExpiraEm: Date | null;
    observacoes: string | null;
    criadoPorUsuarioId: string | null;
    criadoEm: Date;
    atualizadoEm: Date;
  }): ComponenteInstalado {
    return {
      id: row.id,
      ordemServicoId: row.ordemServicoId,
      nome: row.nome,
      fabricante: row.fabricante,
      modelo: row.modelo,
      numeroSerie: row.numeroSerie,
      codigoBarras: row.codigoBarras,
      garantiaMeses: row.garantiaMeses,
      garantiaExpiraEm: row.garantiaExpiraEm,
      observacoes: row.observacoes,
      criadoPorUsuarioId: row.criadoPorUsuarioId,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
    };
  }
}
