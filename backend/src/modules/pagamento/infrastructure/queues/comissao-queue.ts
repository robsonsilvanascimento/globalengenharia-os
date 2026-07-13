import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface ComissaoJobData {
  pagamentoOSId: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const calcularComissaoQueue = new Queue<ComissaoJobData>('calcular-comissao', {
  connection: redisConnection,
  defaultJobOptions,
});

export async function enqueueCalcularComissao(data: ComissaoJobData): Promise<void> {
  await calcularComissaoQueue.add('calcular-comissao', data);
}
