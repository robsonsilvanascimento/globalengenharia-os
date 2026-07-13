import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuditLogRepository } from './AuditLogService';

// Entidades e rotas que devem ser auditadas automaticamente
const ROTAS_AUDITADAS: Array<{
  metodo: string;
  padrao: RegExp;
  entidade: string;
  acao: 'criar' | 'atualizar' | 'apagar';
}> = [
  { metodo: 'POST', padrao: /^\/ordens-servico$/, entidade: 'OrdemServico', acao: 'criar' },
  { metodo: 'PATCH', padrao: /^\/ordens-servico\/[^/]+\/status$/, entidade: 'OrdemServico', acao: 'atualizar' },
  { metodo: 'PATCH', padrao: /^\/ordens-servico\/[^/]+\/tecnico$/, entidade: 'OrdemServico', acao: 'atualizar' },
  { metodo: 'PATCH', padrao: /^\/ordens-servico\/[^/]+\/valor$/, entidade: 'OrdemServico', acao: 'atualizar' },
  { metodo: 'PUT', padrao: /^\/ordens-servico\/[^/]+\/estimativa-custo$/, entidade: 'EstimativaCusto', acao: 'atualizar' },
  { metodo: 'POST', padrao: /^\/ordens-servico\/[^/]+\/componentes$/, entidade: 'ComponenteInstalado', acao: 'criar' },
  { metodo: 'POST', padrao: /^\/ordens-servico\/[^/]+\/documentos$/, entidade: 'DocumentoOS', acao: 'criar' },
  { metodo: 'DELETE', padrao: /^\/ordens-servico\/[^/]+\/documentos\/[^/]+$/, entidade: 'DocumentoOS', acao: 'apagar' },
  { metodo: 'POST', padrao: /^\/usuarios$/, entidade: 'Usuario', acao: 'criar' },
  { metodo: 'PATCH', padrao: /^\/usuarios\/[^/]+$/, entidade: 'Usuario', acao: 'atualizar' },
];

function extrairIdDaResposta(corpo: unknown): string {
  if (typeof corpo !== 'object' || corpo === null) return 'desconhecido';
  const c = corpo as Record<string, unknown>;
  return String(c.id ?? c.ordem_servico_id ?? 'desconhecido');
}

function obterIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? request.ip;
  return request.ip;
}

export function registrarAuditoriaMiddleware(
  app: FastifyInstance,
  auditLogRepository: AuditLogRepository,
): void {
  app.addHook('onSend', async (request, reply, payload) => {
    try {
      const url = request.url.split('?')[0] ?? '';
      const metodo = request.method;
      const status = reply.statusCode;

      // Só audita respostas de sucesso (2xx)
      if (status < 200 || status >= 300) return payload;

      const rotaConfig = ROTAS_AUDITADAS.find(
        (r) => r.metodo === metodo && r.padrao.test(url),
      );

      if (!rotaConfig) return payload;

      const usuario = request.user as { id?: string; nome?: string; email?: string } | undefined;

      let corpoResposta: unknown = undefined;
      if (typeof payload === 'string') {
        try {
          corpoResposta = JSON.parse(payload);
        } catch {
          // ignora parse errors
        }
      }

      const entidadeId = extrairIdDaResposta(corpoResposta);

      // Captura body da requisição (sem campos sensíveis)
      const bodyReq = request.body as Record<string, unknown> | undefined;
      const dadosNovos = bodyReq
        ? Object.fromEntries(
            Object.entries(bodyReq).filter(([k]) => !['senha', 'senhaHash', 'conteudo_base64'].includes(k)),
          )
        : null;

      // Fire-and-forget: auditoria não deve bloquear a resposta
      auditLogRepository
        .registrar({
          entidade: rotaConfig.entidade,
          entidadeId,
          acao: rotaConfig.acao,
          dadosNovos: dadosNovos as Record<string, unknown> | null,
          dadosAnteriores: null,
          usuarioId: usuario?.id ?? null,
          nomeUsuario: usuario?.nome ?? usuario?.email ?? null,
          ipAddress: obterIp(request),
          userAgent: request.headers['user-agent'] ?? null,
          descricao: `${metodo} ${url}`,
        })
        .catch(() => {
          // silencia erros de auditoria para não quebrar a requisição
        });
    } catch {
      // Auditoria nunca pode derrubar a resposta principal
    }

    return payload;
  });
}
