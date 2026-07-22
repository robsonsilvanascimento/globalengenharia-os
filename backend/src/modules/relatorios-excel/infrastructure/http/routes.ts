import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { ExcelExportService } from '../ExcelExportService';

const statusOSValues = [
  'aberta',
  'triagem',
  'atribuida',
  'em_andamento',
  'aguardando_peca',
  'concluida',
  'cancelada',
] as const;

const osQuerySchema = z.object({
  dataInicio: z.string().max(30).optional(),
  dataFim: z.string().max(30).optional(),
  status: z.enum(statusOSValues).optional(),
  tecnicoId: z.string().uuid().optional(),
});

const financeiroQuerySchema = z.object({
  dataInicio: z.string().max(30).optional(),
  dataFim: z.string().max(30).optional(),
});

function formatarDataArquivo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registerRelatoriosExcelRoutes(
  app: FastifyInstance,
  deps: { prisma: PrismaClient },
): void {
  const service = new ExcelExportService(deps.prisma);

  app.get(
    '/relatorios/excel/os',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const params = osQuerySchema.parse(request.query);

      const buffer = await service.gerarRelatorioOS(params);
      const filename = `relatorio-os-${formatarDataArquivo()}.xlsx`;

      return reply
        .status(200)
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', buffer.length)
        .send(buffer);
    },
  );

  app.get(
    '/relatorios/excel/financeiro',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request, reply) => {
      const params = financeiroQuerySchema.parse(request.query);

      const buffer = await service.gerarRelatorioFinanceiro(params);
      const filename = `relatorio-financeiro-${formatarDataArquivo()}.xlsx`;

      return reply
        .status(200)
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', buffer.length)
        .send(buffer);
    },
  );
}
