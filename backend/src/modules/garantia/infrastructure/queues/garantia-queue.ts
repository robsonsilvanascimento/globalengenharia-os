import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface AlertaGarantiaJobData {
  [key: string]: unknown;
}

export const alertaGarantiaQueue = new Queue<AlertaGarantiaJobData>('alerta-garantia', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
