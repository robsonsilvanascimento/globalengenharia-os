import { createHash } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyHash?: string;
  }
}

export function buildApiKeyAuth(deps: { prisma: PrismaClient; redis: Redis }) {
  return async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const raw = request.headers['x-api-key'];
    const chave = Array.isArray(raw) ? raw[0] : raw;

    if (!chave) {
      reply.status(401).send({ error: 'API key inválida' });
      return;
    }

    const hash = createHash('sha256').update(chave).digest('hex');

    const apiKey = await deps.prisma.apiKey.findFirst({
      where: { hash, ativa: true },
    });

    if (!apiKey) {
      reply.status(401).send({ error: 'API key inválida' });
      return;
    }

    // fire-and-forget
    void deps.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { ultimoUsoEm: new Date() },
    });

    request.apiKeyHash = hash;
  };
}
