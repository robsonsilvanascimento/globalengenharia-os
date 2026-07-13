import type { FastifyInstance } from 'fastify';
import rateLimit, { type RateLimitOptions, type RateLimitPluginOptions } from '@fastify/rate-limit';

const DEFAULT_MAX = 100;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Registra o plugin de rate limit globalmente com um limite padrao.
 *
 * Por padrao usa o store em memoria (nao depende de Redis estar disponivel
 * para o servidor subir/responder, o que evita acoplar o boot da aplicacao —
 * e o /health — a disponibilidade do Redis). Para rodar com multiplas
 * instancias atras de um load balancer, passe `{ redis: redisConnection }`
 * em `options` para compartilhar o contador entre instancias.
 *
 * `global: true` aplica o limite padrao a todas as rotas; uma rota especifica
 * pode sobrescrever via `config.rateLimit` (ver `buildRouteRateLimit`).
 */
export async function registerRateLimit(
  app: FastifyInstance,
  options?: Partial<RateLimitPluginOptions>,
): Promise<void> {
  await app.register(rateLimit, {
    max: DEFAULT_MAX,
    timeWindow: DEFAULT_WINDOW_MS,
    global: true,
    ...options,
  });
}

/**
 * Helper para configurar um limite especifico por rota:
 *
 *   app.get('/rota', { config: { rateLimit: buildRouteRateLimit({ max: 5, timeWindowMs: 60_000 }) } }, handler)
 */
export function buildRouteRateLimit(opts: {
  max: number;
  timeWindowMs: number;
}): RateLimitOptions {
  return {
    max: opts.max,
    timeWindow: opts.timeWindowMs,
  };
}
