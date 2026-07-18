import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface AlertaEstoqueJobData {
  pecaId: string;
  estoqueAtual: number;
  estoqueMinimo: number;
}

export const alertaEstoqueQueue = new Queue<AlertaEstoqueJobData>('alerta-estoque', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueAlertaEstoque(data: AlertaEstoqueJobData): Promise<void> {
  await alertaEstoqueQueue.add('verificar-estoque', data);
}
