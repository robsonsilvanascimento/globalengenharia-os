import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface AlertaEstoqueJobData {
  pecaId: string;
  estoqueAtual: number;
  estoqueMinimo: number;
}

export const alertaEstoqueQueue = new Queue<AlertaEstoqueJobData>('alerta-estoque', {
  connection: redisConnection,
});

export async function enqueueAlertaEstoque(data: AlertaEstoqueJobData): Promise<void> {
  await alertaEstoqueQueue.add('verificar-estoque', data, { attempts: 3 });
}
