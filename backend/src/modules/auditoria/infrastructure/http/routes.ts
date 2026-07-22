import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import type { AuditLogRepository } from '../../../../shared/infra/auditoria/AuditLogService';

const querySchema = z.object({
  entidade: z.string().max(100).optional(),
  entidade_id: z.string().max(100).optional(),
  usuario_id: z.string().uuid().optional(),
  de: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(200).default(50),
  formato: z.enum(['json', 'csv']).default('json'),
});

const osIdParams = z.object({ id: z.string().uuid() });

export interface AuditoriaRoutesDeps {
  auditLogRepository: AuditLogRepository;
}

type EntradaNormalizada = ReturnType<typeof normalizar>;

function toCSV(dados: EntradaNormalizada[]): string {
  const headers = [
    'id',
    'entidade',
    'entidade_id',
    'acao',
    'descricao',
    'usuario_id',
    'nome_usuario',
    'ip_address',
    'criado_em',
  ];
  const linhas = dados.map((r) =>
    headers
      .map((h) => {
        const v = (r as Record<string, unknown>)[h];
        const s = v instanceof Date ? v.toISOString() : String(v ?? '');
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return [headers.join(','), ...linhas].join('\n');
}

function normalizar(entry: {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAnteriores: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  usuarioId: string | null;
  nomeUsuario: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  descricao: string | null;
  criadoEm: Date;
}) {
  return {
    id: entry.id,
    entidade: entry.entidade,
    entidade_id: entry.entidadeId,
    acao: entry.acao,
    dados_anteriores: entry.dadosAnteriores,
    dados_novos: entry.dadosNovos,
    usuario_id: entry.usuarioId,
    nome_usuario: entry.nomeUsuario,
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
    descricao: entry.descricao,
    criado_em: entry.criadoEm,
  };
}

export function registerAuditoriaRoutes(app: FastifyInstance, deps: AuditoriaRoutesDeps): void {
  const { auditLogRepository } = deps;
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  // GET /audit-log — visão global (admin)
  app.get('/audit-log', somenteAdmin, async (request, reply) => {
    const q = querySchema.parse(request.query);
    const { dados, total } = await auditLogRepository.listar({
      entidade: q.entidade,
      entidadeId: q.entidade_id,
      usuarioId: q.usuario_id,
      de: q.de ? new Date(q.de) : undefined,
      ate: q.ate ? new Date(q.ate) : undefined,
      pagina: q.pagina,
      porPagina: q.por_pagina,
    });

    const normalizados = dados.map(normalizar);

    if (q.formato === 'csv') {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="audit-log.csv"');
      return reply.send(toCSV(normalizados));
    }

    return reply.status(200).send({ data: normalizados, total, pagina: q.pagina, por_pagina: q.por_pagina });
  });

  // GET /ordens-servico/:id/audit-log — audit trail de uma OS específica
  app.get('/ordens-servico/:id/audit-log', somenteAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const q = querySchema.parse(request.query);

    const { dados, total } = await auditLogRepository.listar({
      entidade: 'OrdemServico',
      entidadeId: id,
      pagina: q.pagina,
      porPagina: q.por_pagina,
    });

    const normalizados = dados.map(normalizar);

    if (q.formato === 'csv') {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="audit-log-os-${id}.csv"`);
      return reply.send(toCSV(normalizados));
    }

    return reply.status(200).send({ data: normalizados, total, pagina: q.pagina, por_pagina: q.por_pagina });
  });
}
