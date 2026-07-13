import Redis from 'ioredis';
import { logger } from './Logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

// Conexao singleton do Redis. BullMQ exige maxRetriesPerRequest: null
// quando a mesma conexao e reutilizada por filas/workers.
export const redisConnection: Redis =
  global.__redis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__redis = redisConnection;
}

redisConnection.on('error', (err) => {
  logger.error({ err }, 'Erro na conexao com o Redis');
});

redisConnection.on('connect', () => {
  logger.debug('Conectado ao Redis');
});
