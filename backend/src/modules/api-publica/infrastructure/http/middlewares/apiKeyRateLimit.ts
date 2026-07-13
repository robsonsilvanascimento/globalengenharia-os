import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

export function buildApiKeyRateLimit(deps: { redis: Redis }) {
  return async function apiKeyRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const hash = request.apiKeyHash;

    if (!hash) {
      reply.status(401).send({ error: 'API key inválida' });
      return;
    }

    const window = Math.floor(Date.now() / 60_000);
    const redisKey = `ratelimit:apikey:${hash}:${window}`;

    const count = await deps.redis.incr(redisKey);

    if (count === 1) {
      // Define TTL apenas na primeira requisição da janela
      await deps.redis.expire(redisKey, 60);
    }

    if (count > 100) {
      reply.status(429).send({ error: 'Rate limit excedido' });
      return;
    }
  };
}
