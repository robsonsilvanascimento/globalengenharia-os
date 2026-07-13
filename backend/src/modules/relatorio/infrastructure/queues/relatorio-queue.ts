import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface RelatorioGerencialJobData {
  configId: string;
}

export const relatorioGerencialQueue = new Queue<RelatorioGerencialJobData>(
  'relatorio-gerencial',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
);
