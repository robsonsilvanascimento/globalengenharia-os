import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export type AcaoAuditoria = 'criar' | 'atualizar' | 'apagar' | 'consultar';

export interface RegistrarAuditoriaInput {
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  usuarioId?: string | null;
  nomeUsuario?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  descricao?: string;
}

export interface AuditLogRepository {
  registrar(input: RegistrarAuditoriaInput): Promise<void>;
  listar(filtros: {
    entidade?: string;
    entidadeId?: string;
    usuarioId?: string;
    de?: Date;
    ate?: Date;
    pagina?: number;
    porPagina?: number;
  }): Promise<{ dados: AuditLogEntry[]; total: number }>;
}

export interface AuditLogEntry {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  dadosAnteriores: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  usuarioId: string | null;
  nomeUsuario: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  descricao: string | null;
  criadoEm: Date;
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly client: PrismaClient) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    await this.client.auditLog.create({
      data: {
        id: randomUUID(),
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        acao: input.acao,
        dadosAnteriores: (input.dadosAnteriores ?? undefined) as object | undefined,
        dadosNovos: (input.dadosNovos ?? undefined) as object | undefined,
        usuarioId: input.usuarioId ?? null,
        nomeUsuario: input.nomeUsuario ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        descricao: input.descricao ?? null,
      },
    });
  }

  async listar(filtros: {
    entidade?: string;
    entidadeId?: string;
    usuarioId?: string;
    de?: Date;
    ate?: Date;
    pagina?: number;
    porPagina?: number;
  }): Promise<{ dados: AuditLogEntry[]; total: number }> {
    const pagina = filtros.pagina ?? 1;
    const porPagina = Math.min(filtros.porPagina ?? 50, 200);
    const skip = (pagina - 1) * porPagina;

    const where = {
      ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros.entidadeId ? { entidadeId: filtros.entidadeId } : {}),
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
      ...(filtros.de || filtros.ate
        ? {
            criadoEm: {
              ...(filtros.de ? { gte: filtros.de } : {}),
              ...(filtros.ate ? { lte: filtros.ate } : {}),
            },
          }
        : {}),
    };

    const [dados, total] = await Promise.all([
      this.client.auditLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: porPagina,
      }),
      this.client.auditLog.count({ where }),
    ]);

    return {
      dados: dados.map((r) => ({
        id: r.id,
        entidade: r.entidade,
        entidadeId: r.entidadeId,
        acao: r.acao as AcaoAuditoria,
        dadosAnteriores: r.dadosAnteriores as Record<string, unknown> | null,
        dadosNovos: r.dadosNovos as Record<string, unknown> | null,
        usuarioId: r.usuarioId,
        nomeUsuario: r.nomeUsuario,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        descricao: r.descricao,
        criadoEm: r.criadoEm,
      })),
      total,
    };
  }
}
