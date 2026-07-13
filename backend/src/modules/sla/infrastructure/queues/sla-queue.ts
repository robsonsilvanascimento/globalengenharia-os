import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export const slaVerificacaoQueue = new Queue('sla-verificacao', {
  connection: redisConnection,
});
