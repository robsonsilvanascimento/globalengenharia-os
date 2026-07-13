import { Prisma, type PrismaClient } from '@prisma/client';

export interface OsPorMes {
  mes: string;
  total: number;
}

export interface ReceitaPorMes {
  mes: string;
  valor: number;
}

export interface OsPorStatus {
  status: string;
  total: number;
}

export interface RankingTecnico {
  tecnico_id: string;
  nome: string;
  concluidas: number;
}

export interface TmrCategoria {
  categoria: string;
  horas: number;
}

export interface TmrTecnico {
  tecnico_id: string;
  nome: string;
  horas: number;
}

export interface TmrPrioridade {
  prioridade: string;
  horas: number;
}

export interface AnalyticsResumo {
  os_por_mes: OsPorMes[];
  receita_por_mes: ReceitaPorMes[];
  os_por_status: OsPorStatus[];
  ranking_tecnicos: RankingTecnico[];
  tmr_por_categoria: TmrCategoria[];
  tmr_por_tecnico: TmrTecnico[];
  tmr_por_prioridade: TmrPrioridade[];
}

interface ResumoAnalyticsDeps {
  prisma: PrismaClient;
}

interface ResumoAnalyticsInput {
  dataInicio?: Date;
  dataFim?: Date;
}

export class ResumoAnalyticsUseCase {
  constructor(private readonly deps: ResumoAnalyticsDeps) {}

  async execute(input: ResumoAnalyticsInput = {}): Promise<AnalyticsResumo> {
    const { prisma } = this.deps;
    const { dataInicio, dataFim } = input;

    const filtroDataInicio = dataInicio ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const filtroDataFim = dataFim ?? new Date();

    const [
      osPorMes,
      receitaPorMes,
      osPorStatus,
      rankingTecnicos,
      tmrPorCategoria,
      tmrPorTecnico,
      tmrPorPrioridade,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ mes: Date; total: bigint }>>(Prisma.sql`
        SELECT
          DATE_TRUNC('month', criado_em) AS mes,
          COUNT(*) AS total
        FROM "OrdemServico"
        WHERE criado_em >= ${filtroDataInicio} AND criado_em <= ${filtroDataFim}
        GROUP BY DATE_TRUNC('month', criado_em)
        ORDER BY mes ASC
      `),

      prisma.$queryRaw<Array<{ mes: Date; valor: unknown }>>(Prisma.sql`
        SELECT
          DATE_TRUNC('month', criado_em) AS mes,
          SUM(valor_cobrado) AS valor
        FROM "OrdemServico"
        WHERE valor_cobrado IS NOT NULL
          AND criado_em >= ${filtroDataInicio} AND criado_em <= ${filtroDataFim}
        GROUP BY DATE_TRUNC('month', criado_em)
        ORDER BY mes ASC
      `),

      prisma.ordemServico.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      prisma.$queryRaw<Array<{ tecnico_id: string; nome: string; concluidas: bigint }>>(Prisma.sql`
        SELECT
          os."tecnico_id",
          u.nome,
          COUNT(*) AS concluidas
        FROM "OrdemServico" os
        JOIN "Usuario" u ON u.id = os."tecnico_id"
        WHERE os.status = 'concluida'
          AND os.criado_em >= ${filtroDataInicio} AND os.criado_em <= ${filtroDataFim}
        GROUP BY os."tecnico_id", u.nome
        ORDER BY concluidas DESC
        LIMIT 10
      `),

      prisma.$queryRaw<Array<{ categoria: string; horas: unknown }>>(Prisma.sql`
        SELECT
          cs.nome AS categoria,
          AVG(EXTRACT(EPOCH FROM (os.fechado_em - os.criado_em)) / 3600) AS horas
        FROM "OrdemServico" os
        JOIN "CategoriaServico" cs ON cs.id = os."categoria_servico_id"
        WHERE os.fechado_em IS NOT NULL
          AND os.criado_em >= ${filtroDataInicio} AND os.criado_em <= ${filtroDataFim}
        GROUP BY cs.nome
        ORDER BY horas DESC
      `),

      prisma.$queryRaw<Array<{ tecnico_id: string; nome: string; horas: unknown }>>(Prisma.sql`
        SELECT
          os."tecnico_id",
          u.nome,
          AVG(EXTRACT(EPOCH FROM (os.fechado_em - os.criado_em)) / 3600) AS horas
        FROM "OrdemServico" os
        JOIN "Usuario" u ON u.id = os."tecnico_id"
        WHERE os.fechado_em IS NOT NULL
          AND os."tecnico_id" IS NOT NULL
          AND os.criado_em >= ${filtroDataInicio} AND os.criado_em <= ${filtroDataFim}
        GROUP BY os."tecnico_id", u.nome
        ORDER BY horas DESC
        LIMIT 10
      `),

      prisma.$queryRaw<Array<{ prioridade: string; horas: unknown }>>(Prisma.sql`
        SELECT
          prioridade,
          AVG(EXTRACT(EPOCH FROM (fechado_em - criado_em)) / 3600) AS horas
        FROM "OrdemServico"
        WHERE fechado_em IS NOT NULL
          AND criado_em >= ${filtroDataInicio} AND criado_em <= ${filtroDataFim}
        GROUP BY prioridade
        ORDER BY horas DESC
      `),
    ]);

    return {
      os_por_mes: osPorMes.map((row) => ({
        mes: row.mes.toISOString().slice(0, 7),
        total: Number(row.total),
      })),
      receita_por_mes: receitaPorMes.map((row) => ({
        mes: row.mes.toISOString().slice(0, 7),
        valor: Number(row.valor),
      })),
      os_por_status: osPorStatus.map((row) => ({
        status: row.status,
        total: row._count.id,
      })),
      ranking_tecnicos: rankingTecnicos.map((row) => ({
        tecnico_id: row.tecnico_id,
        nome: row.nome,
        concluidas: Number(row.concluidas),
      })),
      tmr_por_categoria: tmrPorCategoria.map((row) => ({
        categoria: row.categoria,
        horas: Number(row.horas),
      })),
      tmr_por_tecnico: tmrPorTecnico.map((row) => ({
        tecnico_id: row.tecnico_id,
        nome: row.nome,
        horas: Number(row.horas),
      })),
      tmr_por_prioridade: tmrPorPrioridade.map((row) => ({
        prioridade: row.prioridade,
        horas: Number(row.horas),
      })),
    };
  }
}
