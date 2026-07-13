import type { Queue } from 'bullmq';

export async function agendarVerificacaoSla(queue: Queue): Promise<void> {
  await queue.add('verificar', {}, { repeat: { every: 900_000 }, jobId: 'sla-verificacao-recorrente' });
}
