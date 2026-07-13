import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface NpsJobData {
  ordemServicoId: string;
  clienteId: string;
}

export const npsQueue = new Queue<NpsJobData>('nps-pesquisa', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueNpsPesquisa(data: NpsJobData): Promise<void> {
  await npsQueue.add('enviar-pesquisa', data, {
    delay: 24 * 60 * 60 * 1000,
  });
}
