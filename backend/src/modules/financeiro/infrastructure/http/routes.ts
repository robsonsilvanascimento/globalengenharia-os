import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const dateRangeSchema = z.object({
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
});

const comissoesQuerySchema = dateRangeSchema.extend({
  tecnicoId: z.string().uuid().optional(),
});

interface ResumoRow {
  receita_total: unknown;
  receita_paga: unknown;
  receita_pendente: unknown;
  total_os_pagas: bigint;
  total_os_pendentes: bigint;
  total_inadimplentes: bigint;
}

interface FluxoMensalRow {
  mes: Date;
  receita: unknown;
  quantidade: bigint;
}

interface InadimplenteRow {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_cobrado: unknown;
  atualizado_em: Date;
  tecnico_nome: string | null;
}

interface RankingTecnicoRow {
  tecnico_id: string;
  tecnico_nome: string;
  total_gerado: unknown;
  total_os: bigint;
  comissao_total: unknown;
}

interface ComissaoRow {
  id: string;
  tecnico_nome: string;
  os_numero: string;
  valor_pago: number;
  percentual: number;
  valor_comissao: number;
  criado_em: Date;
}

export function registerFinanceiroRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  const { prisma } = deps;

  app.get(
    '/financeiro/resumo',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const query = dateRangeSchema.parse(request.query);
      const dataInicio = query.dataInicio ? new Date(query.dataInicio) : undefined;
      const dataFim = query.dataFim ? new Date(query.dataFim) : undefined;

      const tresDiasAtras = new Date(Date.now() - 3 * 86400000);

      const [resumoRows, fluxoMensal] = await Promise.all([
        prisma.$queryRaw<ResumoRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM(CASE WHEN status_pagamento != 'cancelado' THEN valor_cobrado ELSE 0 END), 0) AS receita_total,
            COALESCE(SUM(CASE WHEN status_pagamento = 'pago' THEN valor_cobrado ELSE 0 END), 0) AS receita_paga,
            COALESCE(SUM(CASE WHEN status_pagamento = 'pendente' AND status = 'concluida' THEN valor_cobrado ELSE 0 END), 0) AS receita_pendente,
            COUNT(CASE WHEN status_pagamento = 'pago' THEN 1 END) AS total_os_pagas,
            COUNT(CASE WHEN status_pagamento = 'pendente' AND status = 'concluida' THEN 1 END) AS total_os_pendentes,
            COUNT(CASE WHEN status = 'concluida' AND status_pagamento = 'pendente' AND atualizado_em < ${tresDiasAtras} THEN 1 END) AS total_inadimplentes
          FROM "OrdemServico"
          WHERE 1=1
            ${dataInicio ? Prisma.sql`AND criado_em >= ${dataInicio}` : Prisma.empty}
            ${dataFim ? Prisma.sql`AND criado_em <= ${dataFim}` : Prisma.empty}
        `),
        prisma.$queryRaw<FluxoMensalRow[]>(Prisma.sql`
          SELECT
            DATE_TRUNC('month', pago_em) AS mes,
            SUM(valor) AS receita,
            COUNT(*) AS quantidade
          FROM "pagamentos_os"
          WHERE status_pagamento = 'pago'
            AND pago_em IS NOT NULL
            ${dataInicio ? Prisma.sql`AND pago_em >= ${dataInicio}` : Prisma.empty}
            ${dataFim ? Prisma.sql`AND pago_em <= ${dataFim}` : Prisma.empty}
          GROUP BY DATE_TRUNC('month', pago_em)
          ORDER BY mes ASC
        `),
      ]);

      const r = resumoRows[0] ?? {
        receita_total: 0,
        receita_paga: 0,
        receita_pendente: 0,
        total_os_pagas: 0n,
        total_os_pendentes: 0n,
        total_inadimplentes: 0n,
      };

      return reply.status(200).send({
        receita_total: Number(r.receita_total),
        receita_paga: Number(r.receita_paga),
        receita_pendente: Number(r.receita_pendente),
        total_os_pagas: Number(r.total_os_pagas),
        total_os_pendentes: Number(r.total_os_pendentes),
        total_inadimplentes: Number(r.total_inadimplentes),
        fluxo_mensal: fluxoMensal.map((row) => ({
          mes: row.mes.toISOString().slice(0, 7),
          receita: Number(row.receita),
          quantidade: Number(row.quantidade),
        })),
      });
    },
  );

  app.get(
    '/financeiro/comissoes',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const query = comissoesQuerySchema.parse(request.query);
      const dataInicio = query.dataInicio ? new Date(query.dataInicio) : undefined;
      const dataFim = query.dataFim ? new Date(query.dataFim) : undefined;

      const rows = await prisma.$queryRaw<ComissaoRow[]>(Prisma.sql`
        SELECT
          c.id,
          u.nome AS tecnico_nome,
          os.numero AS os_numero,
          p.valor AS valor_pago,
          c.percentual,
          c.valor AS valor_comissao,
          c.criado_em
        FROM "comissoes_tecnico" c
        JOIN "Usuario" u ON u.id = c.tecnico_id
        JOIN "pagamentos_os" p ON p.id = c.pagamento_os_id
        JOIN "OrdemServico" os ON os.id = p.ordem_servico_id
        WHERE 1=1
          ${query.tecnicoId ? Prisma.sql`AND c.tecnico_id = ${query.tecnicoId}` : Prisma.empty}
          ${dataInicio ? Prisma.sql`AND c.criado_em >= ${dataInicio}` : Prisma.empty}
          ${dataFim ? Prisma.sql`AND c.criado_em <= ${dataFim}` : Prisma.empty}
        ORDER BY c.criado_em DESC
      `);

      return reply.status(200).send(
        rows.map((row) => ({
          id: row.id,
          tecnico_nome: row.tecnico_nome,
          os_numero: row.os_numero,
          valor_pago: Number(row.valor_pago),
          percentual: Number(row.percentual),
          valor_comissao: Number(row.valor_comissao),
          criado_em: row.criado_em,
        })),
      );
    },
  );

  app.get(
    '/financeiro/inadimplentes',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (_request, reply) => {
      const tresDiasAtras = new Date(Date.now() - 3 * 86400000);

      const lista = await prisma.$queryRaw<InadimplenteRow[]>(Prisma.sql`
        SELECT
          os.id,
          os.numero,
          cl.nome AS cliente_nome,
          os.valor_cobrado,
          os.atualizado_em,
          u.nome AS tecnico_nome
        FROM "OrdemServico" os
        JOIN "Cliente" cl ON cl.id = os.cliente_id
        LEFT JOIN "Usuario" u ON u.id = os.tecnico_id
        WHERE os.status = 'concluida'
          AND os.status_pagamento = 'pendente'
          AND os.atualizado_em < ${tresDiasAtras}
        ORDER BY os.atualizado_em ASC
      `);

      return reply.status(200).send(
        lista.map((os) => ({
          id: os.id,
          numero: os.numero,
          cliente_nome: os.cliente_nome,
          valor_cobrado: Number(os.valor_cobrado ?? 0),
          dias_em_atraso: Math.floor((Date.now() - os.atualizado_em.getTime()) / 86400000),
          tecnico_nome: os.tecnico_nome ?? null,
        })),
      );
    },
  );

  app.get(
    '/financeiro/ranking-tecnicos',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const query = dateRangeSchema.parse(request.query);
      const dataInicio = query.dataInicio ? new Date(query.dataInicio) : undefined;
      const dataFim = query.dataFim ? new Date(query.dataFim) : undefined;

      const rows = await prisma.$queryRaw<RankingTecnicoRow[]>(Prisma.sql`
        SELECT
          os.tecnico_id,
          u.nome AS tecnico_nome,
          SUM(os.valor_cobrado) AS total_gerado,
          COUNT(os.id) AS total_os,
          COALESCE(SUM(c.valor), 0) AS comissao_total
        FROM "OrdemServico" os
        JOIN "Usuario" u ON u.id = os.tecnico_id
        LEFT JOIN "pagamentos_os" p ON p.ordem_servico_id = os.id AND p.status_pagamento = 'pago'
        LEFT JOIN "comissoes_tecnico" c ON c.pagamento_os_id = p.id
        WHERE os.status_pagamento = 'pago'
          AND os.tecnico_id IS NOT NULL
          ${dataInicio ? Prisma.sql`AND os.criado_em >= ${dataInicio}` : Prisma.empty}
          ${dataFim ? Prisma.sql`AND os.criado_em <= ${dataFim}` : Prisma.empty}
        GROUP BY os.tecnico_id, u.nome
        ORDER BY total_gerado DESC
      `);

      return reply.status(200).send(
        rows.map((row) => ({
          tecnico_id: row.tecnico_id,
          tecnico_nome: row.tecnico_nome,
          total_gerado: Number(row.total_gerado),
          total_os: Number(row.total_os),
          comissao_total: Number(row.comissao_total),
        })),
      );
    },
  );
}
