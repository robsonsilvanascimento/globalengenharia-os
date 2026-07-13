import type { Redis } from 'ioredis';

const TTL_SECONDS = 7 * 24 * 60 * 60;

export async function saveNpsToken(
  redis: Redis,
  token: string,
  ordemServicoId: string,
): Promise<void> {
  await redis.set(`nps:token:${token}`, ordemServicoId, 'EX', TTL_SECONDS);
  await redis.set(`nps:os:${ordemServicoId}`, token, 'EX', TTL_SECONDS);
}

export async function getOrdemServicoIdByToken(
  redis: Redis,
  token: string,
): Promise<string | null> {
  return redis.get(`nps:token:${token}`);
}

export async function deleteNpsToken(
  redis: Redis,
  token: string,
  ordemServicoId: string,
): Promise<void> {
  await redis.del(`nps:token:${token}`, `nps:os:${ordemServicoId}`);
}
